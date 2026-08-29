import crypto from "crypto";
import { SSHKeyPair } from "../types";

export function generateEd25519OpenSSH(): SSHKeyPair {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privDer = privateKey.export({ type: "pkcs8", format: "der" });
  const pubDer = publicKey.export({ type: "spki", format: "der" });
  const privRaw = privDer.subarray(privDer.length - 32);
  const pubRaw = pubDer.subarray(pubDer.length - 32);

  function encodeString(buf: Buffer | string) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(b.length, 0);
    return Buffer.concat([len, b]);
  }

  const pubBlob = Buffer.concat([
    encodeString("ssh-ed25519"),
    encodeString(pubRaw)
  ]);
  const public_openssh = "ssh-ed25519 " + pubBlob.toString("base64") + " shot-planner@app";

  const checkInt = crypto.randomBytes(4).readUInt32BE(0);
  const checkIntBuf = Buffer.alloc(4);
  checkIntBuf.writeUInt32BE(checkInt, 0);

  const privAndPub = Buffer.concat([privRaw, pubRaw]);

  let privBlob = Buffer.concat([
    checkIntBuf,
    checkIntBuf,
    encodeString("ssh-ed25519"),
    encodeString(pubRaw),
    encodeString(privAndPub),
    encodeString("shot-planner@app")
  ]);

  const padLen = (8 - (privBlob.length % 8)) % 8;
  const padding = Buffer.alloc(padLen);
  for (let i = 0; i < padLen; i++) padding[i] = i + 1;
  privBlob = Buffer.concat([privBlob, padding]);

  const magic = Buffer.from("openssh-key-v1\0");
  const ciphername = encodeString("none");
  const kdfname = encodeString("none");
  const kdfoptions = encodeString("");
  const numKeys = Buffer.alloc(4);
  numKeys.writeUInt32BE(1, 0);
  const encPubBlob = encodeString(pubBlob);
  const encPrivBlob = encodeString(privBlob);

  const keyBuffer = Buffer.concat([
    magic,
    ciphername,
    kdfname,
    kdfoptions,
    numKeys,
    encPubBlob,
    encPrivBlob
  ]);

  const b64 = keyBuffer.toString("base64");
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 70) {
    lines.push(b64.slice(i, i + 70));
  }

  const private_pem =
    "-----BEGIN OPENSSH PRIVATE KEY-----\n" +
    lines.join("\n") +
    "\n-----END OPENSSH PRIVATE KEY-----\n";

  return { private_key: private_pem, public_key: public_openssh };
}
