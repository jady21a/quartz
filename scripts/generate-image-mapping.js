// scripts/generate-image-mapping-smart.js
// 智能版本 - 支持中文文件名匹配

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONTENT_DIR = path.join(__dirname, '../content/2.Read');
const IMAGES_DIR = path.join(__dirname, '../quartz/static/imgs');
const OUTPUT_FILE = path.join(__dirname, './image-mapping.json');

// 从豆瓣URL提取图片ID
function extractImageId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/(s\d+|p\d+)\.(jpg|webp|png)$/);
  return match ? `${match[1]}.${match[2]}` : null;
}

// 标准化文件名用于匹配
function normalizeForMatch(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[·・：:]/g, '')  // 移除中间点和冒号
    .replace(/\s+/g, '')       // 移除空格
    .replace(/[【】\[\]()（）]/g, '');  // 移除括号
}

// 递归读取所有 Markdown 文件
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
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  return fileList;
}

// 获取本地图片列表及其标准化名称
function getLocalImages() {
  try {
    const files = fs.readdirSync(IMAGES_DIR);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    
    // 返回带标准化名称的对象数组
    return imageFiles.map(filename => ({
      filename,
      normalized: normalizeForMatch(path.parse(filename).name),  // 不包含扩展名
      fullPath: `/imgs/${filename}`
    }));
  } catch (error) {
    console.error('Error reading images directory:', error.message);
    return [];
  }
}

// 提取标题
function extractTitle(frontmatter) {
  let title = frontmatter.title;
  if (Array.isArray(title)) {
    title = title[0];
  }
  if (!title) {
    title = frontmatter.originalTitle;
  }
  return title || '';
}

// 判断是否为影视内容
function isMovie(tags) {
  if (!tags || !Array.isArray(tags)) return false;
  return tags.some(tag => {
    if (!tag) return false;
    const tagLower = String(tag).toLowerCase();
    return ['movies', 'movie', 'teleplay', 'tv', '电影', '电视剧'].includes(tagLower);
  });
}

// 智能匹配图片
function findMatchingImage(title, imageId, localImages) {
  // 方法1: 通过豆瓣ID精确匹配
  if (imageId) {
    const exactMatch = localImages.find(img => img.filename === imageId);
    if (exactMatch) {
      return { path: exactMatch.fullPath, method: 'douban-id' };
    }
  }
  
  // 方法2: 通过标题模糊匹配
  const normalizedTitle = normalizeForMatch(title);
  if (normalizedTitle) {
    const fuzzyMatch = localImages.find(img => {
      // 完全匹配
      if (img.normalized === normalizedTitle) return true;
      
      // 包含关系
      if (img.normalized.includes(normalizedTitle)) return true;
      if (normalizedTitle.includes(img.normalized)) return true;
      
      return false;
    });
    
    if (fuzzyMatch) {
      return { path: fuzzyMatch.fullPath, method: 'fuzzy-match' };
    }
  }
  
  return null;
}

// 生成映射
function generateMapping() {
  console.log('🔍 开始扫描文件...\n');
  
  const markdownFiles = getAllMarkdownFiles(CONTENT_DIR);
  const localImages = getLocalImages();
  
  console.log(`📝 找到 ${markdownFiles.length} 个 Markdown 文件`);
  console.log(`🖼️  找到 ${localImages.length} 个本地图片\n`);
  
  const mapping = {
    books: {},
    movies: {},
    unmapped: {
      books: [],
      movies: []
    }
  };
  
  let booksCount = 0;
  let moviesCount = 0;
  let mappedBooks = 0;
  let mappedMovies = 0;
  let fuzzyMatchCount = 0;
  
  markdownFiles.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data: frontmatter } = matter(content);
      
      const title = extractTitle(frontmatter);
      const cover = frontmatter.封面;
      const tags = frontmatter.tags || [];
      
      if (!title) return;
      
      const imageId = extractImageId(cover);
      const isMovieContent = isMovie(tags);
      
      // 智能匹配图片
      const matchResult = findMatchingImage(title, imageId, localImages);
      
      if (isMovieContent) {
        moviesCount++;
        if (matchResult) {
          mapping.movies[title] = matchResult.path;
          mappedMovies++;
          const emoji = matchResult.method === 'fuzzy-match' ? '🔍' : '✅';
          console.log(`${emoji} [影视] ${title} → ${path.basename(matchResult.path)} (${matchResult.method})`);
          if (matchResult.method === 'fuzzy-match') fuzzyMatchCount++;
        } else {
          mapping.unmapped.movies.push({
            title,
            originalCover: cover,
            suggestedFilename: imageId || 'unknown'
          });
          console.log(`❌ [影视] ${title} - 未找到图片`);
        }
      } else if (frontmatter.封面 || frontmatter.author) {
        booksCount++;
        if (matchResult) {
          mapping.books[title] = matchResult.path;
          mappedBooks++;
          const emoji = matchResult.method === 'fuzzy-match' ? '🔍' : '✅';
          console.log(`${emoji} [书籍] ${title} → ${path.basename(matchResult.path)} (${matchResult.method})`);
          if (matchResult.method === 'fuzzy-match') fuzzyMatchCount++;
        } else {
          mapping.unmapped.books.push({
            title,
            originalCover: cover,
            suggestedFilename: imageId || 'unknown'
          });
          console.log(`❌ [书籍] ${title} - 未找到图片`);
        }
      }
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
    }
  });
  
  // 保存映射文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mapping, null, 2), 'utf-8');
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 统计信息:');
  console.log('='.repeat(60));
  console.log(`📚 书籍总数: ${booksCount}`);
  console.log(`   ✅ 已映射: ${mappedBooks}`);
  console.log(`   ❌ 未映射: ${mapping.unmapped.books.length}`);
  console.log(`\n🎬 影视总数: ${moviesCount}`);
  console.log(`   ✅ 已映射: ${mappedMovies}`);
  console.log(`   ❌ 未映射: ${mapping.unmapped.movies.length}`);
  console.log(`\n🔍 模糊匹配: ${fuzzyMatchCount} 个`);
  console.log('='.repeat(60));
  console.log(`\n💾 映射文件已保存: ${OUTPUT_FILE}`);
  
  if (mapping.unmapped.books.length > 0 || mapping.unmapped.movies.length > 0) {
    console.log('\n⚠️  提示: 有部分内容未找到对应图片');
    console.log('   请检查图片文件名是否匹配,或手动下载缺失的图片');
  }
  
  if (fuzzyMatchCount > 0) {
    console.log('\n💡 提示: 🔍 标记的条目是通过模糊匹配找到的');
    console.log('   建议检查这些映射是否正确');
  }
}

// 执行
try {
  generateMapping();
} catch (error) {
  console.error('❌ 生成失败:', error);
  process.exit(1);
}