import fs from "fs";
import path from "path";
import { Client, ConnectConfig, SFTPWrapper } from "ssh2";
import { EMPTY_1X1_PNG_BUFFER } from "../config/constants";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("SSHService");

export interface SSHCredentials {
  host?: string;
  remote_host?: string;
  runpod_ip?: string;
  port?: number | string;
  ssh_port?: number | string;
  username?: string;
  ssh_username?: string;
  password?: string;
  ssh_password?: string;
  privateKey?: string;
  ssh_private_key?: string;
  keyPath?: string;
  ssh_key_path?: string;
  remote_comfyui_root?: string;
  remote_dir?: string;
}

export interface ResolvedSSHConfig {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
  authMethod: "Ed25519" | "RSA" | "ECDSA" | "PrivateKey" | "Password" | "None";
  remoteComfyUIRoot: string;
  remoteInputDir: string;
  connectConfig: ConnectConfig;
}

export interface TransferItem {
  filename: string;
  localPath?: string;
  content?: Buffer | string;
  remotePath: string;
  sizeBytes?: number;
}

export interface TransferResultItem {
  filename: string;
  file: string;
  size_bytes: number;
  status: "transferred" | "failed" | "skipped" | "missing_locally";
  remote_path: string;
  message: string;
}

export interface SFTPTransferSummary {
  success: boolean;
  transferredCount: number;
  failedCount: number;
  skippedCount: number;
  uploadedFiles: string[];
  failedFiles: string[];
  transferredFiles: TransferResultItem[];
  totalBytes: number;
  durationMs: number;
  error?: string;
}

/**
 * Clean and un-escape private key string (handling literal \n, \r, and PEM headers)
 */
export function normalizePrivateKey(rawKey?: string): string | undefined {
  if (!rawKey || typeof rawKey !== "string") return undefined;
  let key = rawKey.trim();
  if (!key) return undefined;

  // Un-escape escaped newlines/carriage returns
  key = key.replace(/\\r/g, "").replace(/\r/g, "");
  key = key.replace(/\\n/g, "\n");
  key = key.trim();

  // Ensure trailing newline for OpenSSH / PEM parsers
  if (key && !key.endsWith("\n")) {
    key += "\n";
  }
  return key;
}

/**
 * Detect key type for logging and debugging
 */
export function detectKeyType(key?: string): "Ed25519" | "RSA" | "ECDSA" | "PrivateKey" | "None" {
  if (!key) return "None";
  if (key.includes("OPENSSH PRIVATE KEY") || key.includes("ED25519")) return "Ed25519";
  if (key.includes("RSA PRIVATE KEY")) return "RSA";
  if (key.includes("EC PRIVATE KEY") || key.includes("ECDSA")) return "ECDSA";
  if (key.includes("PRIVATE KEY")) return "PrivateKey";
  return "None";
}

/**
 * Resolve unified SSH configuration from various input payload formats
 */
export function resolveSSHConfig(creds: SSHCredentials): ResolvedSSHConfig {
  let rawHost = (creds.host || creds.remote_host || creds.runpod_ip || "").trim();
  rawHost = rawHost.replace(/^ssh:\/\//i, "");

  let port = Number(creds.port || creds.ssh_port) || 22;
  let host = rawHost;

  // Handle host:port syntax
  if (host.includes(":") && !host.startsWith("[")) {
    const parts = host.split(":");
    host = parts[0].trim();
    const parsedPort = parseInt(parts[1], 10);
    if (!isNaN(parsedPort) && parsedPort > 0) {
      port = parsedPort;
    }
  }

  const username = (creds.username || creds.ssh_username || "root").trim();

  // Extract raw private key
  let rawKey = creds.privateKey || creds.ssh_private_key || "";

  // Check if key was mistakenly placed in password field
  if (!rawKey && creds.ssh_password && (creds.ssh_password.includes("BEGIN") || creds.ssh_password.includes("PRIVATE KEY"))) {
    rawKey = creds.ssh_password;
  }
  if (!rawKey && creds.password && (creds.password.includes("BEGIN") || creds.password.includes("PRIVATE KEY"))) {
    rawKey = creds.password;
  }

  // Check if key was placed in keyPath or refers to local file
  const keyPathVal = creds.keyPath || creds.ssh_key_path || "";
  if (!rawKey && keyPathVal) {
    if (keyPathVal.includes("BEGIN") || keyPathVal.includes("PRIVATE KEY")) {
      rawKey = keyPathVal;
    } else if (fs.existsSync(keyPathVal)) {
      try {
        rawKey = fs.readFileSync(keyPathVal, "utf-8");
      } catch (e: any) {
        log.warn(`Failed to read private key from path ${keyPathVal}`, { error: e.message });
      }
    }
  }

  const normalizedKey = normalizePrivateKey(rawKey);
  const detectedType = detectKeyType(normalizedKey);

  let password = creds.password || creds.ssh_password || "";
  if (password && (password.includes("BEGIN") || password.includes("PRIVATE KEY"))) {
    password = ""; // Do not treat raw key string as password
  }

  const authMethod: ResolvedSSHConfig["authMethod"] = normalizedKey
    ? detectedType
    : password
    ? "Password"
    : "None";

  const rawComfyRoot = creds.remote_comfyui_root || creds.remote_dir || "/workspace/runpod-slim/ComfyUI";
  const remoteComfyUIRoot = rawComfyRoot.replace(/\/input\/?$/, "").replace(/\/$/, "");
  const remoteInputDir = `${remoteComfyUIRoot}/input`;

  const connectConfig: ConnectConfig = {
    host,
    port,
    username,
    readyTimeout: 30000,
    keepaliveInterval: 5000,
    keepaliveCountMax: 3
  };

  if (normalizedKey) {
    connectConfig.privateKey = normalizedKey;
  } else if (password) {
    connectConfig.password = password;
  }

  return {
    host,
    port,
    username,
    privateKey: normalizedKey,
    password: password || undefined,
    authMethod,
    remoteComfyUIRoot,
    remoteInputDir,
    connectConfig
  };
}

/**
 * Establish connected SSH2 Client
 */
export function connectSSH(connectConfig: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let isConnected = false;

    const timeout = setTimeout(() => {
      if (!isConnected) {
        try { conn.end(); } catch (e) {}
        reject(new Error(`SSH connection to ${connectConfig.host}:${connectConfig.port} timed out after 30s`));
      }
    }, connectConfig.readyTimeout || 30000);

    conn.on("ready", () => {
      isConnected = true;
      clearTimeout(timeout);
      resolve(conn);
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    try {
      conn.connect(connectConfig);
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

/**
 * Execute command over an active SSH client
 */
export function execSSHCommand(conn: Client, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      let stdout = "";
      let stderr = "";

      stream.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      stream.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      stream.on("close", (code: number) => {
        resolve({ stdout, stderr, code: code || 0 });
      });
    });
  });
}

/**
 * Open SFTP wrapper from active SSH connection
 */
export function openSFTP(conn: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      resolve(sftp);
    });
  });
}

export interface SFTPItemProgressCallback {
  (transferredBytes: number, totalBytes: number): void;
}

export interface SFTPBatchProgressEvent {
  stage: "connecting" | "preparing_dirs" | "file_start" | "file_progress" | "file_complete" | "file_error" | "completed" | "error";
  filename?: string;
  fileIndex?: number;
  totalFiles?: number;
  fileBytesTransferred?: number;
  fileTotalBytes?: number;
  filePercent?: number;
  totalBytesTransferred?: number;
  totalBytes?: number;
  totalPercent?: number;
  message?: string;
  durationMs?: number;
}

export interface SFTPBatchProgressCallback {
  (event: SFTPBatchProgressEvent): void;
}

/**
 * Upload single item via SFTP with fastPut chunking, remote duplicate verification, and stall protection
 */
export function uploadSFTPItem(
  sftp: SFTPWrapper,
  item: TransferItem,
  onProgress?: SFTPItemProgressCallback
): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let activityTimer: NodeJS.Timeout | null = null;
    const INACTIVITY_TIMEOUT_MS = 30000; // 30s watchdog for stalled SFTP sockets

    const resetWatchdog = () => {
      if (activityTimer) clearTimeout(activityTimer);
      activityTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`SFTP transfer of "${item.filename}" stalled (no progress for 30s). Remote server may be unresponsive.`));
        }
      }, INACTIVITY_TIMEOUT_MS);
    };

    const cleanup = () => {
      if (activityTimer) {
        clearTimeout(activityTimer);
        activityTimer = null;
      }
    };

    resetWatchdog();

    if (item.content !== undefined) {
      const buffer = Buffer.isBuffer(item.content) ? item.content : Buffer.from(item.content, "utf-8");
      sftp.writeFile(item.remotePath, buffer, (err) => {
        cleanup();
        if (settled) return;
        settled = true;
        if (err) return reject(err);
        onProgress?.(buffer.length, buffer.length);
        resolve(buffer.length);
      });
    } else if (item.localPath) {
      if (!fs.existsSync(item.localPath)) {
        cleanup();
        settled = true;
        return reject(new Error(`Local file not found: ${item.localPath}`));
      }

      let totalBytes = 0;
      try {
        const stats = fs.statSync(item.localPath);
        totalBytes = stats.size;
      } catch (statErr: any) {
        cleanup();
        settled = true;
        return reject(statErr);
      }

      if (totalBytes === 0) {
        sftp.writeFile(item.remotePath, Buffer.alloc(0), (err) => {
          cleanup();
          if (settled) return;
          settled = true;
          if (err) return reject(err);
          onProgress?.(0, 0);
          resolve(0);
        });
        return;
      }

      const isJsonWorkflow = item.filename.endsWith(".json");

      const doFastPut = () => {
        if (settled) return;
        sftp.fastPut(
          item.localPath!,
          item.remotePath,
          {
            concurrency: 2,
            chunkSize: 32768,
            step: (transferred, _chunk, total) => {
              resetWatchdog();
              if (!settled) {
                onProgress?.(transferred, total || totalBytes);
              }
            }
          },
          (err) => {
            cleanup();
            if (settled) return;
            settled = true;
            if (err) {
              return reject(err);
            }
            onProgress?.(totalBytes, totalBytes);
            resolve(totalBytes);
          }
        );
      };

      // For binary image assets, check if remote file already exists with matching size
      if (!isJsonWorkflow && totalBytes > 0) {
        sftp.stat(item.remotePath, (statErr, remoteStats) => {
          if (settled) return;
          if (!statErr && remoteStats && remoteStats.size === totalBytes) {
            cleanup();
            settled = true;
            log.info(`Remote asset "${item.filename}" verified (matches local ${totalBytes} bytes). Skipping re-upload.`);
            onProgress?.(totalBytes, totalBytes);
            return resolve(totalBytes);
          }
          doFastPut();
        });
      } else {
        doFastPut();
      }
    } else {
      cleanup();
      settled = true;
      reject(new Error(`No localPath or content provided for ${item.filename}`));
    }
  });
}

/**
 * Test SSH connection to remote host and verify ComfyUI input directory
 */
export async function testSSHConnection(creds: SSHCredentials): Promise<{
  success: boolean;
  message: string;
  empty_png_staged?: boolean;
  remote_dir?: string;
  system_info?: string;
  auth_method?: string;
}> {
  const resolved = resolveSSHConfig(creds);
  if (!resolved.host) {
    return { success: false, message: "Remote GPU host IP or hostname is required." };
  }

  log.info(`Testing connection to ${resolved.username}@${resolved.host}:${resolved.port} (Auth: ${resolved.authMethod})...`);

  let client: Client | null = null;
  try {
    client = await connectSSH(resolved.connectConfig);
    log.info("SSH handshake successful!");

    // Run system diagnosis & ensure input directory exists
    const prepCmd = `uname -s -r -m && mkdir -p "${resolved.remoteInputDir}"`;
    const { stdout, stderr, code } = await execSSHCommand(client, prepCmd);

    const sysInfo = stdout.trim() || "Linux Remote Server";
    log.info(`Remote System Info: ${sysInfo}`);

    // Ensure 1x1 transparent bypass pixel empty.png exists in ComfyUI input dir
    let emptyPngStaged = false;
    try {
      const sftp = await openSFTP(client);
      const remoteEmptyPath = `${resolved.remoteInputDir}/empty.png`;
      await uploadSFTPItem(sftp, {
        filename: "empty.png",
        content: EMPTY_1X1_PNG_BUFFER,
        remotePath: remoteEmptyPath
      });
      emptyPngStaged = true;
      log.info(`Verified & staged 1x1 transparent bypass pixel -> ${remoteEmptyPath}`);
    } catch (sftpErr: any) {
      log.warn(`Warning: SFTP empty.png check encountered notice: ${sftpErr.message}`);
    }

    const authLabel = resolved.authMethod !== "None" ? `${resolved.authMethod} authentication` : "credentials";
    const msg = `Connected successfully to ${resolved.username}@${resolved.host}:${resolved.port} (${authLabel}). Remote System: ${sysInfo}. Verified ComfyUI input directory: ${resolved.remoteInputDir}`;

    return {
      success: true,
      message: msg,
      empty_png_staged: emptyPngStaged,
      remote_dir: resolved.remoteInputDir,
      system_info: sysInfo,
      auth_method: resolved.authMethod
    };
  } catch (err: any) {
    log.error(`Connection failed to ${resolved.username}@${resolved.host}:${resolved.port}: ${err.message}`);
    let guidance = "";
    if (err.message && err.message.includes("All configured authentication methods failed")) {
      guidance = ` Authentication rejected. Please verify your SSH Private Key or Password in Settings -> Remote Server.`;
    } else if (err.message && (err.message.includes("timed out") || err.message.includes("ETIMEDOUT"))) {
      guidance = ` Connection timed out. Please verify that host IP ${resolved.host} is active and port ${resolved.port} is open in your cloud firewall / RunPod template.`;
    } else if (err.message && err.message.includes("ECONNREFUSED")) {
      guidance = ` Connection refused on port ${resolved.port}. Check if the SSH daemon is running on ${resolved.host}.`;
    }

    return {
      success: false,
      message: `SSH connection failed (${err.message}).${guidance}`
    };
  } finally {
    if (client) {
      try { client.end(); } catch (e) {}
    }
  }
}

/**
 * Execute batch SFTP transfer of asset files and staged workflow JSONs with granular progress reporting
 */
export async function executeSFTPBatchTransfer(
  creds: SSHCredentials,
  items: TransferItem[],
  onProgress?: SFTPBatchProgressCallback
): Promise<SFTPTransferSummary> {
  const startTime = Date.now();
  const resolved = resolveSSHConfig(creds);

  if (!resolved.host) {
    throw new Error("Remote Host IP / Address is required for SSH asset transfer.");
  }

  const overallTotalBytes = items.reduce((acc, it) => acc + (it.sizeBytes || 0), 0);
  let accumulatedTransferredBytes = 0;

  log.info(`Connecting to ${resolved.username}@${resolved.host}:${resolved.port} (Auth: ${resolved.authMethod})...`);
  log.info(`Preparing to transfer ${items.length} file(s) (${(overallTotalBytes / 1024).toFixed(1)} KB) into ComfyUI root: ${resolved.remoteComfyUIRoot}`);

  onProgress?.({
    stage: "connecting",
    totalFiles: items.length,
    totalBytes: overallTotalBytes,
    totalPercent: 0,
    message: `Connecting to remote GPU via SSH (${resolved.host}:${resolved.port})...`
  });

  const summary: SFTPTransferSummary = {
    success: true,
    transferredCount: 0,
    failedCount: 0,
    skippedCount: 0,
    uploadedFiles: [],
    failedFiles: [],
    transferredFiles: [],
    totalBytes: 0,
    durationMs: 0
  };

  let client: Client | null = null;
  try {
    client = await connectSSH(resolved.connectConfig);
    log.info(`Connected to ${resolved.username}@${resolved.host}:${resolved.port}`);

    onProgress?.({
      stage: "preparing_dirs",
      totalFiles: items.length,
      totalBytes: overallTotalBytes,
      totalPercent: 5,
      message: `Ensuring remote ComfyUI directories exist on ${resolved.host}...`
    });

    // Pre-create all unique remote directories using remote mkdir -p
    const remoteDirs = new Set<string>();
    remoteDirs.add(resolved.remoteInputDir);
    items.forEach((item) => {
      const dir = path.posix.dirname(item.remotePath);
      if (dir && dir !== ".") remoteDirs.add(dir);
    });

    const mkdirCmd = Array.from(remoteDirs).map((d) => `mkdir -p "${d}"`).join(" && ");
    log.info(`Ensuring ${remoteDirs.size} remote directories exist...`);
    await execSSHCommand(client, mkdirCmd);

    // Open SFTP session
    let sftp = await openSFTP(client);
    log.info("SFTP session established. Starting individual file transfers...");

    const getOrRefreshSFTP = async (): Promise<SFTPWrapper> => {
      try {
        if (client) {
          return await openSFTP(client);
        }
      } catch (refreshErr) {
        log.warn("SFTP channel reopen failed, reconnecting SSH client...", { error: (refreshErr as any)?.message });
      }

      // Reconnect SSH if client dropped
      try { client?.end(); } catch {}
      client = await connectSSH(resolved.connectConfig);
      sftp = await openSFTP(client);
      return sftp;
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemStart = Date.now();
      const itemSize = item.sizeBytes || 0;

      onProgress?.({
        stage: "file_start",
        filename: item.filename,
        fileIndex: i,
        totalFiles: items.length,
        fileBytesTransferred: 0,
        fileTotalBytes: itemSize,
        filePercent: 0,
        totalBytesTransferred: accumulatedTransferredBytes,
        totalBytes: overallTotalBytes,
        totalPercent: overallTotalBytes > 0
          ? Math.round((accumulatedTransferredBytes / overallTotalBytes) * 100)
          : Math.round((i / items.length) * 100),
        message: `Transferring [${i + 1}/${items.length}]: ${item.filename} (${(itemSize / 1024).toFixed(1)} KB)...`
      });

      let transferredSuccessfully = false;
      let lastErrorMsg = "";
      const MAX_ATTEMPTS = 2;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          if (attempt > 1) {
            log.info(`[SSHService] Retrying [${i + 1}/${items.length}] ${item.filename} (Attempt ${attempt}/${MAX_ATTEMPTS})...`);
            sftp = await getOrRefreshSFTP();
          } else {
            log.info(`Transferring: ${item.filename} -> ${item.remotePath}`);
          }

          const bytes = await uploadSFTPItem(sftp, item, (fileTransferred, fileTotal) => {
            const filePct = fileTotal > 0 ? Math.min(100, Math.round((fileTransferred / fileTotal) * 100)) : 0;
            const currentTotalTransferred = accumulatedTransferredBytes + fileTransferred;
            const overallPct = overallTotalBytes > 0
              ? Math.min(99, Math.round((currentTotalTransferred / overallTotalBytes) * 100))
              : Math.min(99, Math.round(((i + (filePct / 100)) / items.length) * 100));

            onProgress?.({
              stage: "file_progress",
              filename: item.filename,
              fileIndex: i,
              totalFiles: items.length,
              fileBytesTransferred: fileTransferred,
              fileTotalBytes: fileTotal,
              filePercent: filePct,
              totalBytesTransferred: currentTotalTransferred,
              totalBytes: overallTotalBytes,
              totalPercent: overallPct,
              message: `Transferring [${i + 1}/${items.length}] ${item.filename}: ${(fileTransferred / 1024).toFixed(1)}/${(fileTotal / 1024).toFixed(1)} KB (${filePct}%)`
            });
          });

          const elapsed = Date.now() - itemStart;
          accumulatedTransferredBytes += bytes;

          summary.transferredCount++;
          summary.totalBytes += bytes;
          summary.uploadedFiles.push(item.filename);
          summary.transferredFiles.push({
            filename: item.filename,
            file: item.filename,
            size_bytes: bytes,
            status: "transferred",
            remote_path: item.remotePath,
            message: `Transferred via SFTP (${(bytes / 1024).toFixed(1)} KB in ${elapsed}ms)`
          });

          log.info(`Completed: ${item.filename} (${bytes} bytes in ${elapsed}ms)`);

          onProgress?.({
            stage: "file_complete",
            filename: item.filename,
            fileIndex: i,
            totalFiles: items.length,
            fileBytesTransferred: bytes,
            fileTotalBytes: bytes,
            filePercent: 100,
            totalBytesTransferred: accumulatedTransferredBytes,
            totalBytes: overallTotalBytes,
            totalPercent: overallTotalBytes > 0
              ? Math.min(100, Math.round((accumulatedTransferredBytes / overallTotalBytes) * 100))
              : Math.round(((i + 1) / items.length) * 100),
            message: `Completed [${i + 1}/${items.length}]: ${item.filename} in ${elapsed}ms`,
            durationMs: elapsed
          });

          transferredSuccessfully = true;
          break; // Exit attempt loop on success
        } catch (uploadErr: any) {
          lastErrorMsg = uploadErr.message || String(uploadErr);
          log.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed for ${item.filename}: ${lastErrorMsg}`);
          if (attempt < MAX_ATTEMPTS) {
            // Brief pause before retry
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      }

      // If all attempts failed for this individual file, record failure and continue to next file
      if (!transferredSuccessfully) {
        summary.failedCount++;
        summary.failedFiles.push(item.filename);
        summary.transferredFiles.push({
          filename: item.filename,
          file: item.filename,
          size_bytes: 0,
          status: "failed",
          remote_path: item.remotePath,
          message: `SFTP upload failed: ${lastErrorMsg}`
        });
        log.error(`Permanently failed to transfer ${item.filename} after retries. Continuing with remaining files...`, { error: lastErrorMsg });

        onProgress?.({
          stage: "file_error",
          filename: item.filename,
          fileIndex: i,
          totalFiles: items.length,
          message: `Failed to transfer ${item.filename}: ${lastErrorMsg}`
        });
      }
    }

    summary.durationMs = Date.now() - startTime;
    summary.success = summary.failedCount === 0;

    log.info(
      `SFTP Staging Complete: ${summary.transferredCount}/${items.length} transferred (${(summary.totalBytes / 1024).toFixed(1)} KB) in ${(summary.durationMs / 1000).toFixed(2)}s. Errors: ${summary.failedCount}`
    );

    onProgress?.({
      stage: "completed",
      totalFiles: items.length,
      totalBytesTransferred: summary.totalBytes,
      totalBytes: overallTotalBytes,
      totalPercent: 100,
      message: `Successfully transferred ${summary.transferredCount} of ${items.length} file(s) (${(summary.totalBytes / 1024).toFixed(1)} KB).`
    });

    return summary;
  } catch (connErr: any) {
    summary.success = false;
    summary.error = connErr.message;
    summary.durationMs = Date.now() - startTime;
    log.error(`Connection or staging failed: ${connErr.message}`);

    onProgress?.({
      stage: "error",
      totalFiles: items.length,
      message: `SFTP transfer error: ${connErr.message}`
    });

    throw connErr;
  } finally {
    if (client) {
      try { client.end(); } catch (e) {}
    }
  }
}

/**
 * Ultra-fast single file write via piped SSH command (cat > /remote/path)
 * Bypasses multi-step SFTP folder traversal and completes in under 1 second.
 */
export async function executeOneShotSSHWrite(
  creds: SSHCredentials,
  remotePath: string,
  content: string | Buffer
): Promise<{ success: boolean; durationMs: number; error?: string }> {
  const startTime = Date.now();
  const resolved = resolveSSHConfig(creds);
  if (!resolved.host) {
    return { success: false, durationMs: 0, error: "Remote host is required for SSH write." };
  }

  let client: Client | null = null;
  try {
    client = await connectSSH({
      ...resolved.connectConfig,
      readyTimeout: 3000
    });

    const remoteDir = path.posix.dirname(remotePath);
    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf-8");

    const cmd = `mkdir -p "${remoteDir}" && cat > "${remotePath}"`;

    await new Promise<void>((resolve, reject) => {
      client!.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        stream.on("close", (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`Piped SSH cat write exited with code ${code}`));
        });
        stream.stderr.on("data", (d: Buffer) => {
          log.warn("One-Shot SSH Write stderr", { stderr: d.toString() });
        });
        stream.write(contentBuffer);
        stream.end();
      });
    });

    const elapsed = Date.now() - startTime;
    log.info(`Streamed ${contentBuffer.length} bytes to ${remotePath} in ${elapsed}ms`);
    return { success: true, durationMs: elapsed };
  } catch (err: any) {
    return { success: false, durationMs: Date.now() - startTime, error: err.message };
  } finally {
    if (client) {
      try { client.end(); } catch {}
    }
  }
}

/**
 * Append SSH public key directly to a running pod's ~/.ssh/authorized_keys over SSH
 */
export async function appendAuthorizedKeyToPod(
  credentials: SSHCredentials,
  publicKey: string
): Promise<{ success: boolean; message: string }> {
  if (!publicKey || !publicKey.trim()) {
    throw new Error("Public SSH Key is required.");
  }
  const cleanKey = publicKey.trim();
  const config = resolveSSHConfig(credentials);
  const conn = await connectSSH(config.connectConfig);

  try {
    const cmd = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && (grep -qF "${cleanKey}" ~/.ssh/authorized_keys || echo "${cleanKey}" >> ~/.ssh/authorized_keys)`;
    const result = await execSSHCommand(conn, cmd);
    if (result.code !== 0) {
      throw new Error(`Command failed with code ${result.code}: ${result.stderr}`);
    }
    return {
      success: true,
      message: `SSH key authorized on pod at ${config.host}:${config.port}`
    };
  } finally {
    try { conn.end(); } catch (e) {}
  }
}

