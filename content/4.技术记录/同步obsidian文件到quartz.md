

## 监听工具对比

|工具|推荐度|优点|适合情况|
|---|---|---|---|
|**chokidar-cli**|⭐⭐⭐⭐⭐|轻量、跨平台、Quartz 标配|最推荐|
|**fswatch**|⭐⭐⭐⭐|mac 下性能最强|Mac 用户|
|**nodemon**|⭐⭐⭐|日志清晰|需要日志的人|
|**Syncthing**|⭐⭐⭐⭐|不写代码、自动同步|只想同步文件|

 ## fswatch步骤
### 1.安装
```bash
# 安装
brew install fswatch

# 确认安装
fswatch --version

```

### 2.使用
obsidian路径:/Users/jz/Library/Mobile\ Documents/iCloud\~md\~obsidian/Documents/all\ in/2.Read
quartz路径:/Users/jz/quartz/content/2.Read
#### 2.1创建一个自动化脚本
打开终端, (创建一个文本文件)
```bash
nano ~/sync-quartz.sh
```
把下面的内容复制粘贴进去:
```bash
#!/bin/bash

# Obsidian 路径(iCloud 同步的)
OBSIDIAN_VAULT="/Users/jz/Library/Mobile Documents/iCloud~md~obsidian/Documents/all in/2.Read"

# Quartz 内容路径
QUARTZ_CONTENT="/Users/jz/quartz/content/2.Read"

# Quartz 项目根目录
QUARTZ_DIR="/Users/jz/quartz"

# 记录日志
echo "$(date): 开始同步" >> ~/quartz-sync.log

# 复制文件到 Quartz
cp -r "$OBSIDIAN_VAULT"/* "$QUARTZ_CONTENT/"

# 进入 Quartz 目录并发布
cd "$QUARTZ_DIR"
npx quartz sync

echo "$(date): 同步完成" >> ~/quartz-sync.log
```
windows:按 `Ctrl + X`,然后按 `Y`,再按回车保存
mac:按 `control + X`,然后按 `Y`,再按回车保存
#### 2.2让脚本可以运行
```bash
chmod +x ~/sync-quartz.sh
```



2.3手动测试一次
```bash
~/sync-quartz.sh
```

2.4设置每天自动运行
```bash
crontab -e

# (每天晚上11点)运行:
0 23 * * * /Users/jz/sync-quartz.sh
```
保存退出(Ctrl+X, 然后 Y, 然后回车)




```
fswatch -o /Users/jz/Library/Mobile\ Documents/iCloud\~md\~obsidian/Documents/all\ in/2.Read | xargs -n1 -I{} rsync -av --delete /Users/jz/Library/Mobile\ Documents/iCloud\~md\~obsidian/Documents/all\ in/2.Read/ /Users/jz/quartz/content/2.Read/

```

```
```


### chokidar-cli的具体操作