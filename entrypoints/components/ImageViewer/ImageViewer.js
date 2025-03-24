/**
 * 图片预览增强功能 - 纯JavaScript实现
 */

// 存储全局实例
let viewer = null;

/**
 * 初始化图片查看器
 */
export function initializeImageViewer() {
    // 如果已经初始化过，则不重复初始化
    if (window.linuxDoImageViewer) {
        // console.log('图片查看器已经初始化');
        return window.linuxDoImageViewer;
    }

   // console.log('初始化图片查看器');

    // 创建查看器实例
    viewer = {
        overlay: null,
        imgContainer: null,
        img: null,
        closeBtn: null,
        zoomInBtn: null,
        zoomOutBtn: null,
        resetBtn: null,
        downloadBtn: null,
        infoDisplay: null,
        rotateBtn: null,
        controlsContainer: null,
        currentScale: 1,
        isDragging: false,
        lastX: 0,
        lastY: 0,
        translateX: 0,
        translateY: 0,
        contrastMode: 'normal',
        currentRotation: 0,
        fileSize: null,
        _tempInfoTimers: [],

        // 加载设置
        loadSettings() {
            try {
                const savedContrastMode = localStorage.getItem('linuxdo-contrast-mode');
                if (savedContrastMode) {
                    this.contrastMode = savedContrastMode;
                }

                const savedRotation = localStorage.getItem('linuxdo-rotation');
                if (savedRotation) {
                    this.currentRotation = parseInt(savedRotation, 10);
                }
            } catch (e) {
                console.error('无法加载设置:', e);
            }
        },

        // 保存设置
        saveSettings() {
            try {
                localStorage.setItem('linuxdo-contrast-mode', this.contrastMode);
                localStorage.setItem('linuxdo-rotation', this.currentRotation.toString());
            } catch (e) {
                console.error('无法保存设置:', e);
            }
        },

        // 初始化
        init() {
            // 加载设置
            this.loadSettings();
            
            // 存储绑定的函数引用，以便移除时使用相同的引用
            this._boundImageClick = this.handleImageClick.bind(this);
            this._boundKeyDown = this.handleKeyDown.bind(this);
            
            // 初始化临时信息计时器数组
            this._tempInfoTimers = [];
            
            // 监听页面中所有图片的点击事件
            document.addEventListener('click', this._boundImageClick, true);
            
            // 监听键盘事件
            document.addEventListener('keydown', this._boundKeyDown);
            
            // 添加样式
            this.addStyles();
        },

        // 添加样式
        addStyles() {
            const style = document.createElement('style');
            style.id = 'linuxdo-image-viewer-styles';
            style.textContent = `
        .linuxdo-image-viewer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.9);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }
        
        .linuxdo-image-viewer-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        
        .linuxdo-image-viewer-img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          transition: transform 0.1s ease;
          cursor: grab;
        }
        
        .linuxdo-image-viewer-img.dragging {
          cursor: grabbing;
        }
        
        .linuxdo-image-viewer-controls {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 10px;
          background-color: rgba(0, 0, 0, 0.7);
          padding: 10px;
          border-radius: 8px;
          z-index: 10001;
        }
        
        .linuxdo-image-viewer-btn {
          padding: 8px 12px;
          background-color: #444;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }
        
        .linuxdo-image-viewer-btn:hover {
          background-color: #666;
        }
        
        .linuxdo-image-viewer-info {
          position: fixed;
          top: 20px;
          left: 20px;
          color: white;
          background-color: rgba(0, 0, 0, 0.7);
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 14px;
          z-index: 10001;
        }
        
        .linuxdo-image-viewer-error {
          color: white;
          background-color: rgba(255, 0, 0, 0.7);
          padding: 10px 20px;
          border-radius: 4px;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        
        /* 对比度模式 */
        .linuxdo-image-viewer-img.high-contrast {
          filter: contrast(1.5) brightness(1.1);
        }
        
        .linuxdo-image-viewer-img.night-mode {
          filter: invert(0.9) hue-rotate(180deg);
        }
        
        .linuxdo-image-viewer-img.grayscale {
          filter: grayscale(1);
        }
      `;
            document.head.appendChild(style);
        },

        // 处理图片点击事件
        handleImageClick(e) {
            // 只处理图片元素
            if (e.target.tagName !== 'IMG') return;
            
            if (this.shouldExcludeImage(e.target)) return;
            
            // 只处理帖子内容区域中的图片
            if (this.isPostContentImage(e.target)) {
                //console.log('检测到内容区域图片点击:', e.target.src);
                const originalSrc = this.getOriginalImageUrl(e.target);
                this.openViewer(originalSrc, e.target);
                e.preventDefault();
                e.stopPropagation();
            }
        },

        // 处理键盘事件
        handleKeyDown(e) {
            // 如果当前没有打开查看器，则不处理
            if (!this.overlay || !this.img) return;
            
            switch (e.key) {
                case 'Escape':
                    this.close();
                    break;
                case '+':
                case '=':
                    this.zoom(0.1);
                    break;
                case '-':
                    this.zoom(-0.1);
                    break;
                case '0':
                    this.resetZoom();
                    break;
                case 'r':
                    this.rotate(90);
                    break;
                case 'd':
                    this.downloadImage();
                    break;
            }
        },

        // 判断是否是帖子内容中的图片
        isPostContentImage(imgElement) {
            // 在LINUX DO论坛中，帖子内容通常包含在以下选择器中的元素内
            const validSelectors = [
                '.topic-body .cooked',
                '.topic-body .post-content',
                '.lightbox-wrapper',
                '.cooked img:not(.emoji)'
            ];

            // 检查图片是否在有效的内容选择器中
            return validSelectors.some(selector => {
                return imgElement.closest(selector) !== null;
            });
        },

        // 判断是否应该排除此图片
        shouldExcludeImage(imgElement) {
            if (
                imgElement.closest('.avatar') !== null ||
                imgElement.classList.contains('avatar') ||
                imgElement.closest('.user-card-avatar') !== null ||
                imgElement.closest('.user-image') !== null
            ) {
                return true;
            }

            if (imgElement.classList.contains('emoji')) {
                return true;
            }

            if (
                imgElement.closest('header') !== null ||
                imgElement.closest('nav') !== null ||
                imgElement.closest('.site-header') !== null ||
                imgElement.closest('.menu-panel') !== null ||
                imgElement.closest('.d-header') !== null ||
                imgElement.width < 40 ||
                imgElement.height < 40
            ) {
                return true;
            }

            return false;
        },

        // 获取原始图片URL
        getOriginalImageUrl(imgElement) {
            // 检查是否有父级链接元素
            const parentAnchor = imgElement.closest('a');
            if (parentAnchor &&
                parentAnchor.href &&
                (parentAnchor.href.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) ||
                    parentAnchor.href.includes('/uploads/default/original/'))) {
                return parentAnchor.href;
            }

            // 检查data-orig-src属性
            if (imgElement.dataset.origSrc) {
                return imgElement.dataset.origSrc;
            }

            // 检查原始URL属性
            if (imgElement.dataset.originalUrl) {
                return imgElement.dataset.originalUrl;
            }

            // 最后返回图片的src
            return imgElement.src;
        },

        // 创建查看器元素
        createViewerElements() {
            // 创建遮罩层
            this.overlay = document.createElement('div');
            this.overlay.className = 'linuxdo-image-viewer-overlay';
            this.overlay.addEventListener('click', (e) => {
                // 先检查组件是否还存在
                if (!this.overlay || !this.img) {
                    return;
                }
                
                const isImg = e.target === this.img;
                // 添加null检查
                const isControl = e.target === this.controlsContainer || 
                    (this.controlsContainer && this.controlsContainer.contains(e.target));

                // 如果点击的不是图片也不是控制按钮，则关闭查看器
                if (!isImg && !isControl) {
                    this.close();
                }
            });

            // 创建图片容器
            this.imgContainer = document.createElement('div');
            this.imgContainer.className = 'linuxdo-image-viewer-container';

            // 创建图片元素
            this.img = document.createElement('img');
            this.img.className = 'linuxdo-image-viewer-img';
            this.img.addEventListener('mousedown', this.startDrag.bind(this));
            document.addEventListener('mousemove', this.drag.bind(this));
            document.addEventListener('mouseup', this.endDrag.bind(this));
            this.img.addEventListener('wheel', this.handleWheel.bind(this));

            // 创建图片信息显示
            this.infoDisplay = document.createElement('div');
            this.infoDisplay.className = 'linuxdo-image-viewer-info';

            // 创建控制按钮
            this.controlsContainer = document.createElement('div');
            this.controlsContainer.className = 'linuxdo-image-viewer-controls';

            // 放大按钮
            this.zoomInBtn = document.createElement('button');
            this.zoomInBtn.className = 'linuxdo-image-viewer-btn';
            this.zoomInBtn.textContent = '放大';
            this.zoomInBtn.addEventListener('click', () => this.zoom(0.1));

            // 缩小按钮
            this.zoomOutBtn = document.createElement('button');
            this.zoomOutBtn.className = 'linuxdo-image-viewer-btn';
            this.zoomOutBtn.textContent = '缩小';
            this.zoomOutBtn.addEventListener('click', () => this.zoom(-0.1));

            // 重置按钮
            this.resetBtn = document.createElement('button');
            this.resetBtn.className = 'linuxdo-image-viewer-btn';
            this.resetBtn.textContent = '重置';
            this.resetBtn.addEventListener('click', () => this.resetZoom());

            // 旋转按钮
            this.rotateBtn = document.createElement('button');
            this.rotateBtn.className = 'linuxdo-image-viewer-btn';
            this.rotateBtn.textContent = '旋转';
            this.rotateBtn.addEventListener('click', () => this.rotate(90));

            // 下载按钮
            this.downloadBtn = document.createElement('button');
            this.downloadBtn.className = 'linuxdo-image-viewer-btn';
            this.downloadBtn.textContent = '下载';
            this.downloadBtn.addEventListener('click', () => this.downloadImage());

            // 对比度切换按钮
            this.contrastBtn = document.createElement('button');
            this.contrastBtn.className = 'linuxdo-image-viewer-btn';
            this.contrastBtn.textContent = '对比度';
            this.contrastBtn.addEventListener('click', () => this.toggleContrastMode());

            // 关闭按钮
            this.closeBtn = document.createElement('button');
            this.closeBtn.className = 'linuxdo-image-viewer-btn';
            this.closeBtn.textContent = '关闭';
            this.closeBtn.addEventListener('click', () => this.close());

            // 添加所有元素到DOM
            this.controlsContainer.appendChild(this.zoomInBtn);
            this.controlsContainer.appendChild(this.zoomOutBtn);
            this.controlsContainer.appendChild(this.resetBtn);
            this.controlsContainer.appendChild(this.rotateBtn);
            this.controlsContainer.appendChild(this.contrastBtn);
            this.controlsContainer.appendChild(this.downloadBtn);
            this.controlsContainer.appendChild(this.closeBtn);

            this.imgContainer.appendChild(this.img);
            this.overlay.appendChild(this.imgContainer);
            this.overlay.appendChild(this.infoDisplay);
            this.overlay.appendChild(this.controlsContainer);

            document.body.appendChild(this.overlay);
        },

        // 打开图片查看器
        openViewer(imageSrc, sourceElement) {
            // 如果已经有查看器打开，则先关闭
            this.close();

            // 创建查看器元素
            this.createViewerElements();

            // 设置图片源
            this.img.onload = () => {
                this.updateImageDimensions();
                this.applyContrastMode();

                // 获取图片文件大小
                this.getImageFileSize(imageSrc);
            };

            this.img.onerror = () => {
                this.showError('无法加载图片');
            };

            this.img.src = imageSrc;
        },

        // 获取图片文件大小
        getImageFileSize(url) {
            fetch(url, { method: 'HEAD' })
                .then(response => {
                    const size = response.headers.get('content-length');
                    if (size) {
                        this.fileSize = this.formatFileSize(parseInt(size, 10));
                        this.updateImageDimensions();
                    }
                })
                .catch(error => {
                    console.error('无法获取图片大小:', error);
                });
        },

        // 格式化文件大小
        formatFileSize(bytes) {
            if (bytes < 1024) {
                return bytes + ' B';
            } else if (bytes < 1024 * 1024) {
                return (bytes / 1024).toFixed(2) + ' KB';
            } else {
                return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
            }
        },

        // 更新图片尺寸信息
        updateImageDimensions() {
            // 显示图片尺寸信息
            let infoText = `${this.img.naturalWidth} × ${this.img.naturalHeight}`;
            infoText += ` - ${Math.round(this.currentScale * 100)}%`;

            if (this.fileSize) {
                infoText += ` - ${this.fileSize}`;
            }

            this.infoDisplay.textContent = infoText;
            this.infoDisplay.style.display = 'block';
        },

        // 应用对比度模式
        applyContrastMode() {
            // 移除所有模式类
            this.img.classList.remove('high-contrast', 'night-mode', 'grayscale');

            // 添加当前模式类
            if (this.contrastMode !== 'normal') {
                this.img.classList.add(this.contrastMode);
            }
        },

        // 切换对比度模式
        toggleContrastMode() {
            const modes = ['normal', 'high-contrast', 'night-mode', 'grayscale'];
            const currentIndex = modes.indexOf(this.contrastMode);
            const nextIndex = (currentIndex + 1) % modes.length;
            this.contrastMode = modes[nextIndex];

            this.applyContrastMode();
            this.saveSettings();

            // 显示当前模式（临时）
            const currentMode = this.getModeDisplayName(this.contrastMode);
            const tempInfo = document.createElement('div');
            tempInfo.className = 'linuxdo-image-viewer-info temp-message';
            tempInfo.textContent = `对比度模式: ${currentMode}`;
            tempInfo.style.top = '60px';
            tempInfo.style.position = 'fixed';
            document.body.appendChild(tempInfo);

            // 存储计时器ID以便稍后清理
            const timerId = setTimeout(() => {
                if (tempInfo && tempInfo.parentNode) {
                    tempInfo.parentNode.removeChild(tempInfo);
                }
            }, 1500);
            
            if (this._tempInfoTimers) {
                this._tempInfoTimers.push(timerId);
            }
        },

        // 获取模式显示名称
        getModeDisplayName(mode) {
            const modeNames = {
                'normal': '正常',
                'high-contrast': '高对比度',
                'night-mode': '夜间模式',
                'grayscale': '灰度'
            };
            return modeNames[mode] || mode;
        },

        // 开始拖动
        startDrag(e) {
            if (e.button !== 0) return; // 只处理左键

            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.img.classList.add('dragging');
            e.preventDefault();
        },

        // 拖动过程
        drag(e) {
            if (!this.isDragging || !this.img) return;
            
            const deltaX = e.clientX - this.lastX;
            const deltaY = e.clientY - this.lastY;
            
            this.translateX += deltaX;
            this.translateY += deltaY;
            
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            
            this.updateImageTransform();
            e.preventDefault();
        },

        // 结束拖动
        endDrag() {
            this.isDragging = false;
            if (this.img) {
                this.img.classList.remove('dragging');
            }
        },

        // 处理滚轮事件
        handleWheel(e) {
            e.preventDefault();

            // 缩放比例
            const delta = -Math.sign(e.deltaY) * 0.1;
            this.zoom(delta);
        },

        // 缩放
        zoom(delta) {
            const newScale = Math.max(0.1, Math.min(5, this.currentScale + delta));
            this.currentScale = newScale;

            this.updateImageTransform();
            this.updateImageDimensions();
        },

        // 重置缩放
        resetZoom() {
            this.currentScale = 1;
            this.translateX = 0;
            this.translateY = 0;
            this.currentRotation = 0;

            this.updateImageTransform();
            this.updateImageDimensions();
        },

        // 旋转
        rotate(degrees) {
            this.currentRotation = (this.currentRotation + degrees) % 360;
            this.updateImageTransform();
            this.saveSettings();

            // 显示旋转信息（临时）
            const tempInfo = document.createElement('div');
            tempInfo.className = 'linuxdo-image-viewer-info temp-message';
            tempInfo.textContent = `旋转: ${this.currentRotation}°`;
            tempInfo.style.top = '60px';
            tempInfo.style.position = 'fixed';
            document.body.appendChild(tempInfo);

            // 存储计时器ID以便稍后清理
            const timerId = setTimeout(() => {
                if (tempInfo && tempInfo.parentNode) {
                    tempInfo.parentNode.removeChild(tempInfo);
                }
            }, 1500);
            
            if (this._tempInfoTimers) {
                this._tempInfoTimers.push(timerId);
            }
        },

        // 更新图片变换
        updateImageTransform() {
            if (!this.img) return;
            this.img.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.currentScale}) rotate(${this.currentRotation}deg)`;
        },

        // 下载图片
        downloadImage() {
            if (!this.img || !this.img.src) return;

            const a = document.createElement('a');
            a.href = this.img.src;
            a.download = this.getFileName(this.img.src);
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        },

        // 获取文件名
        getFileName(url) {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            let filename = pathname.split('/').pop();

            // 如果没有扩展名，添加.jpg
            if (!filename.includes('.')) {
                filename += '.jpg';
            }

            return filename;
        },

        // 显示错误信息
        showError(message) {
            const errorElement = document.createElement('div');
            errorElement.className = 'linuxdo-image-viewer-error';
            errorElement.textContent = message;

            if (this.imgContainer) {
                this.imgContainer.innerHTML = '';
                this.imgContainer.appendChild(errorElement);
            }
        },

        // 关闭查看器
        close() {
            if (this.overlay) {
                // 移除所有临时提示元素
                const tempInfos = document.querySelectorAll('.linuxdo-image-viewer-info.temp-message');
                tempInfos.forEach(el => {
                    if (el && el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                });
                
                // 清除所有可能的超时任务
                if (this._tempInfoTimers) {
                    this._tempInfoTimers.forEach(timer => clearTimeout(timer));
                    this._tempInfoTimers = [];
                }
                
                // 移除事件监听器
                document.removeEventListener('mousemove', this.drag);
                document.removeEventListener('mouseup', this.endDrag);

                // 从DOM中移除查看器
                document.body.removeChild(this.overlay);

                // 重置状态
                this.overlay = null;
                this.imgContainer = null;
                this.img = null;
                this.closeBtn = null;
                this.zoomInBtn = null;
                this.zoomOutBtn = null;
                this.resetBtn = null;
                this.downloadBtn = null;
                this.infoDisplay = null;
                this.rotateBtn = null;
                this.controlsContainer = null;
                this.currentScale = 1;
                this.isDragging = false;
                this.lastX = 0;
                this.lastY = 0;
                this.translateX = 0;
                this.translateY = 0;
            }
        },

        // 销毁查看器
        destroy() {
            // 关闭查看器并移除事件监听器
            this.close();
            
            // 移除监听器 - 使用存储的绑定函数引用
            if (this._boundImageClick) {
                document.removeEventListener('click', this._boundImageClick, true);
            }
            
            if (this._boundKeyDown) {
                document.removeEventListener('keydown', this._boundKeyDown);
            }
            
            // 移除样式
            const style = document.getElementById('linuxdo-image-viewer-styles');
            if (style) {
                document.head.removeChild(style);
            }
            
            //console.log('图片查看器销毁完成');
            
            // 简化恢复逻辑
            try {
                // 触发页面刷新以恢复原始功能
                const event = new Event('resize');
                window.dispatchEvent(event);
            } catch (e) {
                console.error('恢复原始图片预览功能失败:', e);
            }
        }
    };

    // 初始化查看器
    viewer.init();

    // 保存到全局变量
    window.linuxDoImageViewer = viewer;

    return viewer;
}

/**
 * 销毁图片查看器
 */
export function destroyImageViewer() {
    if (window.linuxDoImageViewer) {
        // console.log('销毁图片查看器');
        window.linuxDoImageViewer.destroy();
        window.linuxDoImageViewer = null;
    }

    if (viewer) {
        viewer = null;
    }
}

export default {
    initializeImageViewer,
    destroyImageViewer
}; 