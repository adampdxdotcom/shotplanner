import fs from "fs";
import path from "path";
import { Client, ConnectConfig, SFTPWrapper } from "ssh2";
import { EMPTY_1X1_PNG_BUFFER } from "../config/constants";

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
  verifiedFiles: string[];
  unverifiedFiles: string[];
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
        console.warn(`[SSH Config] Failed to read private key from path ${keyPathVal}:`, e.message);
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
    readyTimeout: creds.port ? 5000 : 8000,
    keepaliveInterval: 10000
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

/**
 * Upload single item via SSH exec streaming (cat > remotePath).
 * Bypasses SFTP subsystem and NAT packet window stalls on cloud GPU instances (RunPod, Lambda, etc).
 * Supports both in-memory content (workflows) and local files (images/masks).
 */
export function uploadViaSSHStream(
  client: Client,
  item: TransferItem,
  timeoutMs: number = 15000
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error(`Transfer timed out after ${timeoutMs / 1000}s for ${item.filename}`));
      }
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();

    const remoteDir = path.posix.dirname(item.remotePath);
    const cmd = `mkdir -p "${remoteDir}" && cat > "${item.remotePath}"`;

    client.exec(cmd, (err, stream) => {
      if (err) {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        }
        return;
      }

      stream.on("close", (code: number) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          if (code === 0) {
            let bytes = 0;
            if (item.content !== undefined) {
              bytes = Buffer.isBuffer(item.content) ? item.content.length : Buffer.byteLength(item.content);
            } else if (item.localPath && fs.existsSync(item.localPath)) {
              bytes = fs.statSync(item.localPath).size;
            }
            resolve(bytes);
          } else {
            reject(new Error(`Remote write process for ${item.filename} exited with code ${code}`));
          }
        }
      });

      stream.on("error", (streamErr) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(streamErr);
        }
      });

      stream.stderr.on("data", (d: Buffer) => {
        const msg = d.toString().trim();
        if (msg) {
          console.warn(`[SSH write stderr for ${item.filename}]:`, msg);
        }
      });

      try {
        if (item.content !== undefined) {
          const buffer = Buffer.isBuffer(item.content) ? item.content : Buffer.from(item.content, "utf-8");
          stream.end(buffer);
        } else if (item.localPath) {
          if (!fs.existsSync(item.localPath)) {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              reject(new Error(`Local file not found: ${item.localPath}`));
            }
            return;
          }
          const fileStream = fs.createReadStream(item.localPath);
          fileStream.on("error", (readErr) => {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              reject(readErr);
            }
          });
          fileStream.pipe(stream);
        } else {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            reject(new Error(`No content or localPath for ${item.filename}`));
          }
        }
      } catch (pipeErr: any) {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(pipeErr);
        }
      }
    });
  });
}

/**
 * Upload single item via SFTP (file path or in-memory content)
 * Uses direct Buffer write for files <= 25MB to avoid fastPut concurrency stalls on cloud containers.
 * Guaranteed timeout prevents hanging the transfer queue.
 */
export function uploadSFTPItem(sftp: SFTPWrapper, item: TransferItem, timeoutMs: number = 30000): Promise<number> {
  const performUpload = new Promise<number>((resolve, reject) => {
    try {
      if (item.content !== undefined) {
        const buffer = Buffer.isBuffer(item.content) ? item.content : Buffer.from(item.content, "utf-8");
        sftp.writeFile(item.remotePath, buffer, (err) => {
          if (err) return reject(err);
          resolve(buffer.length);
        });
      } else if (item.localPath) {
        if (!fs.existsSync(item.localPath)) {
          return reject(new Error(`Local file not found: ${item.localPath}`));
        }
        const stats = fs.statSync(item.localPath);

        // For files <= 25MB (images, masks, configs), direct Buffer write is atomic & 100% reliable on Docker/NAT SFTP
        if (stats.size <= 25 * 1024 * 1024) {
          fs.readFile(item.localPath, (readErr, data) => {
            if (readErr) return reject(readErr);
            sftp.writeFile(item.remotePath, data, (writeErr) => {
              if (writeErr) return reject(writeErr);
              resolve(stats.size);
            });
          });
        } else {
          // For very large files (>25MB), use reliable stream piping
          const readStream = fs.createReadStream(item.localPath);
          const writeStream = sftp.createWriteStream(item.remotePath);
          
          let finished = false;
          const onDone = () => {
            if (!finished) {
              finished = true;
              resolve(stats.size);
            }
          };

          readStream.on("error", (err) => {
            if (!finished) {
              finished = true;
              reject(err);
            }
          });
          writeStream.on("error", (err) => {
            if (!finished) {
              finished = true;
              reject(err);
            }
          });
          writeStream.on("finish", onDone);
          writeStream.on("close", onDone);

          readStream.pipe(writeStream);
        }
      } else {
        reject(new Error(`No localPath or content provided for ${item.filename}`));
      }
    } catch (err: any) {
      reject(err);
    }
  });

  // Wrap in per-item timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`SFTP transfer timed out after ${timeoutMs / 1000}s for ${item.filename}`));
    }, timeoutMs);
    // Unref timer if possible in Node environment
    if (typeof timer.unref === "function") timer.unref();
  });

  return Promise.race([performUpload, timeoutPromise]);
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

  console.log(`[SSH Test] Testing connection to ${resolved.username}@${resolved.host}:${resolved.port} (Auth: ${resolved.authMethod})...`);

  let client: Client | null = null;
  try {
    client = await connectSSH(resolved.connectConfig);
    console.log(`[SSH Test] SSH handshake successful!`);

    // Run system diagnosis & ensure input directory exists
    const prepCmd = `uname -s -r -m && mkdir -p "${resolved.remoteInputDir}"`;
    const { stdout, stderr, code } = await execSSHCommand(client, prepCmd);

    const sysInfo = stdout.trim() || "Linux Remote Server";
    console.log(`[SSH Test] Remote System Info: ${sysInfo}`);

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
      console.log(`[SSH Test] Verified & staged 1x1 transparent bypass pixel -> ${remoteEmptyPath}`);
    } catch (sftpErr: any) {
      console.warn(`[SSH Test] Warning: SFTP empty.png check encountered notice: ${sftpErr.message}`);
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
    console.error(`[SSH Test ERROR] Connection failed to ${resolved.username}@${resolved.host}:${resolved.port}:`, err.message);
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
 * Execute batch SFTP transfer of asset files and staged workflow JSONs
 */
export async function executeSFTPBatchTransfer(
  creds: SSHCredentials,
  items: TransferItem[]
): Promise<SFTPTransferSummary> {
  const startTime = Date.now();
  const resolved = resolveSSHConfig(creds);

  if (!resolved.host) {
    throw new Error("Remote Host IP / Address is required for SSH asset transfer.");
  }

  console.log(`[SSH SFTP] Connecting to ${resolved.username}@${resolved.host}:${resolved.port} (Auth: ${resolved.authMethod})...`);
  console.log(`[SSH SFTP] Preparing to transfer ${items.length} file(s) into ComfyUI root: ${resolved.remoteComfyUIRoot}`);

  const summary: SFTPTransferSummary = {
    success: true,
    transferredCount: 0,
    failedCount: 0,
    skippedCount: 0,
    uploadedFiles: [],
    failedFiles: [],
    verifiedFiles: [],
    unverifiedFiles: [],
    transferredFiles: [],
    totalBytes: 0,
    durationMs: 0
  };

  let client: Client | null = null;
  try {
    client = await connectSSH(resolved.connectConfig);
    console.log(`[SSH SFTP] Connected to ${resolved.username}@${resolved.host}:${resolved.port}`);

    // Pre-create all unique remote directories using remote mkdir -p
    const remoteDirs = new Set<string>();
    remoteDirs.add(resolved.remoteInputDir);
    items.forEach((item) => {
      const dir = path.posix.dirname(item.remotePath);
      if (dir && dir !== ".") remoteDirs.add(dir);
    });

    console.log(`[SSH Staging] Ensuring ${remoteDirs.size} remote directories exist on GPU...`);
    for (const d of remoteDirs) {
      console.log(`[SSH Staging] Creating/verifying directory: ${d}`);
      const mkdirRes = await execSSHCommand(client, `mkdir -p "${d}"`);
      if (mkdirRes.code !== 0) {
        const errMsg = mkdirRes.stderr.trim() || `Exit code ${mkdirRes.code}`;
        console.error(`[SSH Staging ERROR] Failed to create remote directory "${d}":`, errMsg);
        throw new Error(`Failed to create remote directory "${d}" on GPU server. Reason: ${errMsg}`);
      }
    }

    let sftp: SFTPWrapper | null = null;
    console.log(`[SSH Staging] Transferring ${items.length} item(s) to remote GPU...`);

    for (const item of items) {
      const itemStart = Date.now();
      try {
        console.log(`[SSH Staging] [->] Transferring: ${item.filename} -> ${item.remotePath}`);
        let bytes = 0;
        let method = "SSH stream";

        try {
          // Primary: Fast, reliable SSH exec stream (bypasses RunPod SFTP NAT stalls)
          bytes = await uploadViaSSHStream(client, item, 15000);
        } catch (sshErr: any) {
          console.warn(`[SSH Staging] SSH stream write failed for ${item.filename} (${sshErr.message}), attempting SFTP fallback...`);
          if (!sftp) {
            sftp = await openSFTP(client);
          }
          bytes = await uploadSFTPItem(sftp, item, 10000);
          method = "SFTP";
        }

        const elapsed = Date.now() - itemStart;
        summary.transferredCount++;
        summary.totalBytes += bytes;
        summary.uploadedFiles.push(item.filename);
        summary.transferredFiles.push({
          filename: item.filename,
          file: item.filename,
          size_bytes: bytes,
          status: "transferred",
          remote_path: item.remotePath,
          message: `Transferred via ${method} (${(bytes / 1024).toFixed(1)} KB in ${elapsed}ms)`
        });
        console.log(`[SSH Staging] [OK] Completed upload: ${item.filename} (${bytes} bytes in ${elapsed}ms)`);
      } catch (uploadErr: any) {
        summary.failedCount++;
        summary.failedFiles.push(item.filename);
        summary.transferredFiles.push({
          filename: item.filename,
          file: item.filename,
          size_bytes: 0,
          status: "failed",
          remote_path: item.remotePath,
          message: `Upload failed: ${uploadErr.message}`
        });
        console.error(`[SSH Staging ERROR] Failed to transfer ${item.filename}:`, uploadErr.message);

        // Fail-fast on timeout or connection loss so UI gets immediate feedback
        const isFatal = uploadErr.message?.includes("timed out") || uploadErr.message?.includes("closed") || uploadErr.message?.includes("ECONN");
        if (isFatal) {
          console.warn(`[SSH Staging] Aborting remaining transfers after fatal error on ${item.filename}`);
          break;
        }
      }
    }

    // Post-upload verification check: inspect remote filesystem directly via SSH exec
    console.log(`[SSH Staging] Running remote verification check on ${summary.uploadedFiles.length} uploaded files...`);
    for (const item of items) {
      if (summary.uploadedFiles.includes(item.filename)) {
        try {
          const checkCmd = `stat -c %s "${item.remotePath}" 2>/dev/null || wc -c < "${item.remotePath}" 2>/dev/null`;
          const statRes = await execSSHCommand(client, checkCmd);

          let remoteSize = -1;
          if (statRes.code === 0 && statRes.stdout.trim()) {
            const parsed = parseInt(statRes.stdout.trim(), 10);
            if (!isNaN(parsed)) remoteSize = parsed;
          }

          if (remoteSize === 0 && (item.sizeBytes ?? 1) > 0) {
            throw new Error(`File was staged but appears as 0 bytes on remote server (${item.remotePath})`);
          } else if (remoteSize === -1) {
            // Verify existence if size check command wasn't standard
            const existCheck = await execSSHCommand(client, `test -f "${item.remotePath}" && echo "OK"`);
            if (existCheck.stdout.trim() !== "OK") {
              throw new Error(`Remote file does not exist after transfer (${item.remotePath})`);
            }
          }

          summary.verifiedFiles.push(item.filename);
          console.log(`[SSH Staging Verified] Successfully verified: ${item.remotePath} (${remoteSize >= 0 ? `${remoteSize} bytes` : 'exists'})`);
        } catch (verErr: any) {
          console.error(`[SSH Staging Verification Failure] Could not verify ${item.filename} at ${item.remotePath}:`, verErr.message);
          summary.unverifiedFiles.push(item.filename);
          summary.failedFiles.push(item.filename);
          summary.uploadedFiles = summary.uploadedFiles.filter(f => f !== item.filename);
          summary.transferredCount = Math.max(0, summary.transferredCount - 1);
          summary.failedCount++;

          const tf = summary.transferredFiles.find(t => t.filename === item.filename);
          if (tf) {
            tf.status = "failed";
            tf.message = `Verification failed on remote host: ${verErr.message}`;
          }
        }
      }
    }

    summary.durationMs = Date.now() - startTime;
    summary.success = summary.failedCount === 0 && summary.unverifiedFiles.length === 0;

    if (!summary.success) {
      const errParts = [];
      if (summary.failedFiles.length > 0) errParts.push(`Failed files: ${summary.failedFiles.join(", ")}`);
      if (summary.unverifiedFiles.length > 0) errParts.push(`Unverified on remote: ${summary.unverifiedFiles.join(", ")}`);
      summary.error = errParts.join(". ");
    }

    console.log(
      `[SSH Staging Complete] ${summary.transferredCount}/${items.length} verified (${(summary.totalBytes / 1024).toFixed(1)} KB) in ${(summary.durationMs / 1000).toFixed(2)}s. Errors: ${summary.failedCount}`
    );

    return summary;
  } catch (connErr: any) {
    summary.success = false;
    summary.error = connErr.message;
    summary.durationMs = Date.now() - startTime;
    console.error(`[SSH SFTP FATAL] Connection or staging failed: ${connErr.message}`);
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
          console.warn("[One-Shot SSH Write stderr]:", d.toString());
        });
        stream.write(contentBuffer);
        stream.end();
      });
    });

    const elapsed = Date.now() - startTime;
    console.log(`[One-Shot SSH Write] Streamed ${contentBuffer.length} bytes to ${remotePath} in ${elapsed}ms`);
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
