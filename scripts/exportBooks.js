import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ✅ 这三行替代 CommonJS 的 __dirname 功能
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === 示例逻辑 ===
const contentDir = path.join(__dirname, "..","content", "read","douban","book");

console.log("📚 正在读取文件夹：", contentDir);

if (!fs.existsSync(contentDir)) {
  console.error("❌ 文件夹不存在，请确认路径是否正确");
  process.exit(1);
}

// 简单列出文件名
const files = fs.readdirSync(contentDir);
console.log("✅ 找到文件：", files);
