// scripts/merge-manual-mappings.js
// 自动合并手动映射到现有映射文件

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAPPING_FILE = path.join(__dirname, './image-mapping.json');

// 手动补充的映射
const manualMappings = {
  books: {
    "飘": "/imgs/飘.jpg",
    "无穷的开始": "/imgs/无穷的开始.jpg",
    "理性乐观派": "/imgs/理性乐观派.jpg",
    "表面活性剂、胶体与界面化学基础（崔正刚）（第二版）": "/imgs/表面活性剂第二版.png"
  },
  
  movies: {
    "不可饶恕": "/imgs/p1083392613.jpg",
    "你好，李焕英": "/imgs/p2530599636.jpg",
    "出走的决心": "/imgs/p2629056068.jpg",
    "周处除三害": "/imgs/p2918020941.jpg",
    "哪吒之魔童闹海": "/imgs/p2915454411.jpg",
    "大人物拿破仑": "/imgs/p2920972910.jpg",
    "大话西游之大圣娶亲": "/imgs/p2161514326.jpg",
    "好家伙": "/imgs/p2455050536.jpg",
    "小偷家族": "/imgs/p2551995207.jpg",
    "小妇人": "/imgs/p2589107401.jpg",
    "小猪宝贝": "/imgs/p453851762.jpg",
    "怪物": "/imgs/p2916323291.jpg",
    "分裂": "/imgs/分裂.webp",
    "猫狗大战": "/imgs/猫狗大战.webp",
    "抓娃娃": "/imgs/p2914761624.jpg",
    "指环王1：护戒使者": "/imgs/p2161515392.jpg",
    "指环王2：双塔奇兵": "/imgs/p2197698335.jpg",
    "机器人之梦": "/imgs/p2912830708.jpg",
    "神秘村": "/imgs/p2918312477.jpg",
    "第六感": "/imgs/p2220184425.jpg",
    "篮坛怪杰": "/imgs/p2540518828.jpg",
    "老狐狸": "/imgs/p2910105262.jpg",
    "花样年华": "/imgs/p2268743922.jpg",
    "调音师": "/imgs/p2572928166.jpg",
    "1923第二季": "/imgs/p2575818042.webp",
    "阿浅来了": "/imgs/p2640236255.jpg"
  }
};

function mergeMappings() {
  console.log('🔧 开始合并映射文件...\n');
  
  // 读取现有映射
  let existingMapping = { books: {}, movies: {}, unmapped: { books: [], movies: [] } };
  
  if (fs.existsSync(MAPPING_FILE)) {
    try {
      existingMapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
      console.log('✅ 读取现有映射文件');
    } catch (error) {
      console.error('❌ 读取映射文件失败:', error.message);
      return;
    }
  } else {
    console.warn('⚠️  映射文件不存在,将创建新文件');
  }
  
  let addedBooks = 0;
  let addedMovies = 0;
  let updatedBooks = 0;
  let updatedMovies = 0;
  
  // 合并书籍映射
  console.log('\n📚 合并书籍映射:');
  for (const [title, path] of Object.entries(manualMappings.books)) {
    if (existingMapping.books[title]) {
      console.log(`   🔄 更新: ${title}`);
      updatedBooks++;
    } else {
      console.log(`   ➕ 新增: ${title} → ${path.split('/').pop()}`);
      addedBooks++;
    }
    existingMapping.books[title] = path;
  }
  
  // 合并影视映射
  console.log('\n🎬 合并影视映射:');
  for (const [title, path] of Object.entries(manualMappings.movies)) {
    if (existingMapping.movies[title]) {
      console.log(`   🔄 更新: ${title}`);
      updatedMovies++;
    } else {
      console.log(`   ➕ 新增: ${title} → ${path.split('/').pop()}`);
      addedMovies++;
    }
    existingMapping.movies[title] = path;
  }
  
  // 更新 unmapped 列表(移除已映射的项)
  existingMapping.unmapped.books = existingMapping.unmapped.books.filter(
    item => !existingMapping.books[item.title]
  );
  existingMapping.unmapped.movies = existingMapping.unmapped.movies.filter(
    item => !existingMapping.movies[item.title]
  );
  
  // 保存合并后的映射
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(existingMapping, null, 2), 'utf-8');
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 合并统计:');
  console.log('='.repeat(60));
  console.log(`📚 书籍: 新增 ${addedBooks} 个, 更新 ${updatedBooks} 个`);
  console.log(`🎬 影视: 新增 ${addedMovies} 个, 更新 ${updatedMovies} 个`);
  console.log(`\n✅ 总映射数:`);
  console.log(`   书籍: ${Object.keys(existingMapping.books).length}`);
  console.log(`   影视: ${Object.keys(existingMapping.movies).length}`);
  console.log(`\n❌ 仍未映射:`);
  console.log(`   书籍: ${existingMapping.unmapped.books.length}`);
  console.log(`   影视: ${existingMapping.unmapped.movies.length}`);
  console.log('='.repeat(60));
  console.log(`\n💾 映射文件已更新: ${MAPPING_FILE}`);
  console.log('\n🚀 下一步: 运行以下命令重新生成索引');
  console.log('   npm run generate-books && npm run generate-movies');
}

try {
  mergeMappings();
} catch (error) {
  console.error('❌ 合并失败:', error);
  process.exit(1);
}