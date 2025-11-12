import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/randomNotes.scss"

interface Options {
  title?: string
  limit?: number
  showTags?: boolean
}

const defaultOptions: Options = {
  title: "漫步笔记",
  limit: 3,
  showTags: true,
}

export default ((userOpts?: Partial<Options>) => {
  const opts = { ...defaultOptions, ...userOpts } as Required<Options>

  const RandomNotes: QuartzComponent = ({ 
    allFiles, 
    fileData, 
    displayClass 
  }: QuartzComponentProps) => {
    // 过滤掉当前页面和索引页面
    const currentSlug = fileData.slug
    const eligibleFiles = allFiles.filter(
      file => 
        file.slug !== currentSlug && 
        !file.slug?.endsWith("index") &&
        file.frontmatter?.title&&
        !(file.frontmatter?.tags || []).includes("movies") // ⬅ 新增这一行
    )

    // 随机选择指定数量的笔记
    const getRandomFiles = (files: typeof eligibleFiles, count: number) => {
      const shuffled = [...files].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, count)
    }

    const randomFiles = getRandomFiles(eligibleFiles, opts.limit)

    if (eligibleFiles.length === 0) {
      return null
    }

    // 将所有符合条件的文件数据序列化
    const filesData = eligibleFiles.map(file => ({
      slug: file.slug,
      title: file.frontmatter?.title || file.slug || "Untitled",
      tags: file.frontmatter?.tags || []
    }))
    
    const configData = {
      files: filesData,
      limit: opts.limit,
      showTags: opts.showTags
    }

    return (
      <div class={`random-notes ${displayClass ?? ""}`}>
        <h3>{opts.title}</h3>
        <ul class="random-notes-list" data-random-notes-list>
          {randomFiles.map((file) => {
            const title = file.frontmatter?.title || file.slug || "Untitled"
            const tags = file.frontmatter?.tags || []
            
            return (
              <li key={file.slug}>
                <a href={`/${file.slug}`} class="internal">
                  {title}
                </a>
                {opts.showTags && tags.length > 0 && (
                  <div class="random-note-tags">
                    {tags.slice(0, 2).map((tag: string) => (
                      <span class="tag" key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <button 
          class="refresh-button"
          data-refresh-random-notes
          data-config={JSON.stringify(configData)}
          aria-label="刷新随机笔记"
        >
           换一批
        </button>
      </div>
    )
  }

  RandomNotes.afterDOMLoaded = `
    function initRandomNotes() {
      const button = document.querySelector('[data-refresh-random-notes]');
      const list = document.querySelector('[data-random-notes-list]');
      
      if (!button || !list) {
        console.log('RandomNotes: Elements not found');
        return;
      }
      
      try {
        const configAttr = button.getAttribute('data-config');
        if (!configAttr) {
          console.error('RandomNotes: No config data found');
          return;
        }
        
        const data = JSON.parse(configAttr);
        const files = data.files;
        const limit = data.limit;
        const showTags = data.showTags;
        
        console.log('RandomNotes: Initialized with', files.length, 'files');
        
        button.addEventListener('click', function(e) {
          e.preventDefault();
          console.log('RandomNotes: Refresh clicked');
          
          // 随机打乱并选择
          const shuffled = [...files].sort(() => Math.random() - 0.5);
          const selected = shuffled.slice(0, limit);
          
          // 重新渲染列表
          list.innerHTML = selected.map(file => {
            let tagsHtml = '';
            if (showTags && file.tags && file.tags.length > 0) {
              const displayTags = file.tags.slice(0, 2);
              tagsHtml = '<div class="random-note-tags">' + 
                displayTags.map(tag => '<span class="tag">#' + tag + '</span>').join('') +
                '</div>';
            }
            
            return '<li>' +
              '<a href="/' + file.slug + '" class="internal">' + file.title + '</a>' +
              tagsHtml +
              '</li>';
          }).join('');
          
          // 添加按钮点击动画
          button.style.transform = 'rotate(360deg)';
          setTimeout(() => {
            button.style.transform = 'rotate(0deg)';
          }, 300);
        });
      } catch (error) {
        console.error('RandomNotes: Error initializing', error);
      }
    }
    
    // 页面加载时初始化
    initRandomNotes();
    
    // 支持 SPA 导航后重新初始化
    document.addEventListener('nav', initRandomNotes);
  `

  RandomNotes.css = style
  return RandomNotes
}) satisfies QuartzComponentConstructor