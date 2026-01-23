// scripts/generate-book-index.js
// ES Modules 版本 - 支持图片映射

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 加载图片映射 =====
let imageMapping = { books: {}, movies: {} };
try {
  const mappingPath = path.join(__dirname, './image-mapping.json');
  if (fs.existsSync(mappingPath)) {
    imageMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    console.log('✅ 已加载图片映射文件');
  }
} catch (error) {
  console.warn('⚠️  未找到图片映射文件,将使用原始封面链接');
}

// ===== 处理图片路径 =====
function processImagePath(originalPath, title) {
  // 优先使用映射文件中的路径
  if (imageMapping.books[title]) {
    return imageMapping.books[title];
  }
  
  // 如果已经是本地路径,直接返回
  if (originalPath && (originalPath.startsWith('/imgs/') || originalPath.startsWith('./imgs/'))) {
    return originalPath;
  }
  
  // 尝试从豆瓣URL提取图片ID
  if (originalPath && typeof originalPath === 'string') {
    const match = originalPath.match(/\/(s\d+|p\d+)\.(jpg|webp|png)$/);
    if (match) {
      return `/imgs/${match[1]}.${match[2]}`;
    }
  }
  
  // 返回原始路径作为后备
  return originalPath || '';
}

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

// 改进版：支持字符串和 Date 对象
function cleanDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    return value.split('T')[0];
  }
  return value;
}

// 检查是否是影视内容
function isMovieOrTV(tags) {
  if (!tags || !Array.isArray(tags)) return false;
  
  return tags.some(tag => {
    if (!tag) return false;
    const tagLower = String(tag).toLowerCase();
    return tagLower === 'movies' || 
           tagLower === 'movie' ||
           tagLower === 'teleplay' ||
           tagLower === 'tv' ||
           tagLower === '电影' ||
           tagLower === '电视剧';
  });
}

// 提取书籍数据
function extractBookData(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data: frontmatter } = matter(content);

    // 处理 tags
    const tags = frontmatter.tags || [];
    const tagsArray = Array.isArray(tags) ? tags : [tags];

    // 排除影视内容
    if (isMovieOrTV(tagsArray)) {
      return null;
    }

    // 只处理有书籍相关字段的文件
    if (!frontmatter.封面 && !frontmatter.author && !frontmatter.阅读状态) {
      return null;
    }

    // 计算相对路径用于链接
    const relativePath = filePath
      .replace(/^.*?content\//, '/')
      .replace(/\.md$/, '');
    
    // 提取标题
    let title = frontmatter.title;
    if (Array.isArray(title)) {
      title = title[0];
    }
    if (!title) {
      title = path.basename(filePath, '.md');
    }
      
    return {
      file: relativePath,
      title: title,
      封面: processImagePath(frontmatter.封面, title),  // ⭐ 使用图片映射
      originalTitle: frontmatter.originalTitle || '',
      author: frontmatter.author || '',
      scoreStar: frontmatter.scoreStar || '',
      score: frontmatter.score || '',
      publishDate: cleanDate(frontmatter.publishDate || ''),
      myRate: frontmatter.myRate || '',
      阅读状态: frontmatter.阅读状态 || '',
      totalPage: frontmatter.totalPage || '',
      currentPage: frontmatter.currentPage || '',
      添加时间: cleanDate(frontmatter.添加时间 || ''),
      开始时间: cleanDate(frontmatter.开始时间 || ''),
      结束阅读: cleanDate(frontmatter.结束阅读 || ''),
      tags: tagsArray.filter(tag => tag),
    };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return null;
  }
}

// 主函数
function generateBookIndex() {
  console.log('📚 Scanning for book files...');
  
  const bookDir = path.join(__dirname, '../content/2.Read');
  
  if (!fs.existsSync(bookDir)) {
    console.error(`❌ Directory not found: ${bookDir}`);
    console.log('💡 Tip: Update the bookDir path in the script to match your folder structure.');
    console.log('   Current path:', bookDir);
    
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
  console.log(`📝 Found ${markdownFiles.length} markdown files`);
  
  const allItems = markdownFiles.map(extractBookData);
  const books = allItems.filter(book => book !== null);
  const excludedCount = allItems.length - books.length;
  
  console.log(`✅ Extracted ${books.length} books with metadata`);
  console.log(`🎬 Excluded ${excludedCount} files (movies/TV or missing metadata)`);
  
  if (books.length === 0) {
    console.warn('⚠️  No books found with required metadata (封面, author, or 阅读状态)');
    console.log('💡 Make sure your book files have frontmatter with these fields.');
    return;
  }
  
  const staticDir = path.join(__dirname, '../quartz/static');
  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true });
  }
  
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
  
  if (books.length > 0) {
    console.log(`\n📖 Sample book:`);
    const sample = books[0];
    console.log(`   Title: ${sample.title}`);
    console.log(`   Cover: ${sample.封面}`);
    console.log(`   Author: ${sample.author}`);
    console.log(`   Status: ${sample.阅读状态}`);
  }
}

generateBookIndex();