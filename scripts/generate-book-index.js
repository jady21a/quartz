// scripts/generate-book-index.js
// ES Modules 版本

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

// 获取当前文件的目录路径（ES modules 中没有 __dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 递归读取目录下的所有 .md 文件
function getAllMarkdownFiles(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        getAllMarkdownFiles(filePath, fileList);
      } else if (file.endsWith('.md')) {
        fileList.push(filePath);
      }
    });
  } catch (error) {
    // 目录不存在时跳过
  }
  
  return fileList;
}

// 提取书籍数据
function extractBookData(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data: frontmatter } = matter(content);
    
    // 只处理有书籍相关字段的文件
    if (!frontmatter.封面 && !frontmatter.author && !frontmatter.阅读状态) {
      return null;
    }
    
    // 计算相对路径用于链接
    const relativePath = filePath
      .replace(/^.*?content\//, '/')
      .replace(/\.md$/, '');
    
    return {
      file: relativePath,
      title: frontmatter.title || path.basename(filePath, '.md'),
      封面: frontmatter.封面 || '',
      originalTitle: frontmatter.originalTitle || '',
      author: frontmatter.author || '',
      scoreStar: frontmatter.scoreStar || '',
      score: frontmatter.score || '',
      publishDate: frontmatter.publishDate || '',
      myRate: frontmatter.myRate || '',
      阅读状态: frontmatter.阅读状态 || '',
      totalPage: frontmatter.totalPage || '',
      currentPage: frontmatter.currentPage || '',
      添加时间: frontmatter.添加时间 || '',
      结束阅读: frontmatter.结束阅读 || '',
    };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return null;
  }
}

// 主函数
function generateBookIndex() {
  console.log('🔍 Scanning for book files...');
  
  // 扫描书籍目录
  const bookDir = path.join(__dirname, '../content/Read/douban');
  
  if (!fs.existsSync(bookDir)) {
    console.error(`❌ Directory not found: ${bookDir}`);
    console.log('💡 Tip: Update the bookDir path in the script to match your folder structure.');
    console.log('   Current path:', bookDir);
    
    // 尝试扫描整个 content 目录作为后备
    console.log('\n🔄 Trying to scan entire content directory...');
    const contentDir = path.join(__dirname, '../content');
    if (fs.existsSync(contentDir)) {
      scanAndGenerate(contentDir);
      return;
    } else {
      console.error('❌ Content directory not found either.');
      return;
    }
  }
  
  scanAndGenerate(bookDir);
}

function scanAndGenerate(directory) {
  const markdownFiles = getAllMarkdownFiles(directory);
  console.log(`📚 Found ${markdownFiles.length} markdown files`);
  
  // 提取所有书籍数据
  const books = markdownFiles
    .map(extractBookData)
    .filter(book => book !== null);
  
  console.log(`✅ Extracted ${books.length} books with metadata`);
  
  if (books.length === 0) {
    console.warn('⚠️  No books found with required metadata (封面, author, or 阅读状态)');
    console.log('💡 Make sure your book files have frontmatter with these fields.');
    return;
  }
  
  // 确保 static 目录存在
  const staticDir = path.join(__dirname, '../quartz/static');
  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true });
  }
  
  // 写入 JSON 文件
  const outputPath = path.join(staticDir, 'book-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(books, null, 2));
  
  console.log(`💾 Book index saved to: ${outputPath}`);
  console.log(`\n📊 Statistics:`);
  console.log(`   Total books: ${books.length}`);
  
  const statusCounts = books.reduce((acc, book) => {
    const status = book.阅读状态 || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  
  // 显示示例书籍
  if (books.length > 0) {
    console.log(`\n📖 Sample book:`);
    const sample = books[0];
    console.log(`   Title: ${sample.title}`);
    console.log(`   Author: ${sample.author}`);
    console.log(`   Status: ${sample.阅读状态}`);
  }
}

// 执行
generateBookIndex();