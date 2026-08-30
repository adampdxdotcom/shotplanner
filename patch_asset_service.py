import re
with open("server/services/assetService.ts", "r") as f:
    content = f.read()

# Replace writeStream.on("finish" ... to add explicit check
chunk_finish = """      writeStream.on("finish", () => {
        this.uploadChunks.delete(upload_id);
        
        if (!fs.existsSync(finalPath)) {
          return reject(new Error("Failed to write assembled chunked file. File missing."));
        }
        
        const stats = fs.statSync(finalPath);"""

content = re.sub(
    r'      writeStream\.on\("finish", \(\) => \{\n        this\.uploadChunks\.delete\(upload_id\);\n        const stats = fs\.statSync\(finalPath\);',
    chunk_finish,
    content
)

with open("server/services/assetService.ts", "w") as f:
    f.write(content)
