/**
 * 获取提示选择器的CSS样式
 * @returns 样式字符串
 */
export function getPromptSelectorStyles(): string {
    return `
    /* 基础样式重置 */
    * {
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      text-autospace: normal !important;
    }
    
    /* 主题相关变量 - 亮色模式默认值 */
    :host {
      --qp-bg-overlay: rgba(15, 23, 42, 0.42);
      --qp-bg-primary: #ffffff;
      --qp-bg-secondary: #f8fafc;
      --qp-bg-hover: #f1f5f9;
      --qp-bg-selected: #eff6ff;
      --qp-bg-tag: #f1f5f9;
      --qp-text-primary: #0f172a;
      --qp-text-secondary: #475569;
      --qp-text-tag: #64748b;
      --qp-border-color: #e2e8f0;
      --qp-focus-ring: #3b82f6;
      --qp-shadow-color: rgba(15, 23, 42, 0.08);
      --qp-green: #10b981;
      --qp-accent: #2563eb;
      --qp-accent-light: #60a5fa;
      --qp-accent-hover: #1d4ed8;
      --qp-shadow: 0 24px 70px rgba(15, 23, 42, 0.18), 0 8px 24px rgba(15, 23, 42, 0.08);
    }

    /* 暗黑模式变量 */
    :host([data-theme="dark"]) {
      --qp-bg-overlay: rgba(2, 6, 23, 0.72);
      --qp-bg-primary: #0f172a;
      --qp-bg-secondary: #111827;
      --qp-bg-hover: #1e293b;
      --qp-bg-selected: #172554;
      --qp-bg-tag: #1e293b;
      --qp-text-primary: #f8fafc;
      --qp-text-secondary: #cbd5e1;
      --qp-text-tag: #cbd5e1;
      --qp-border-color: #334155;
      --qp-focus-ring: #60a5fa;
      --qp-shadow-color: rgba(0, 0, 0, 0.28);
      --qp-green: #34d399;
      --qp-accent: #60a5fa;
      --qp-accent-hover: #93c5fd;
      --qp-shadow: 0 24px 80px rgba(0, 0, 0, 0.45), 0 8px 28px rgba(0, 0, 0, 0.28);
    }

    :where(
      button:not(:disabled):hover,
      [role="button"]:not([aria-disabled="true"]):hover,
      [role="menuitem"]:not([aria-disabled="true"]):hover,
      [role="option"]:not([aria-disabled="true"]):hover,
      [role="tab"]:not([aria-disabled="true"]):hover,
      a[href]:hover,
      summary:hover,
      label[for]:hover,
      input[type="button"]:not(:disabled):hover,
      input[type="submit"]:not(:disabled):hover,
      input[type="reset"]:not(:disabled):hover,
      input[type="checkbox"]:not(:disabled):hover,
      input[type="radio"]:not(:disabled):hover,
      input[type="file"]:not(:disabled):hover,
      select:not(:disabled):hover
    ) {
      cursor: pointer !important;
    }
    
    /* 移植原来的样式 */
    .qp-fixed {
      position: fixed !important;
    }
    
    .qp-inset-0 {
      top: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      left: 0 !important;
    }
    
    .qp-flex {
      display: flex !important;
    }
    
    .qp-flex-col {
      flex-direction: column !important;
    }
    
    .qp-items-center {
      align-items: center !important;
    }
    
    .qp-justify-center {
      justify-content: center !important;
    }

    .qp-justify-between {
      justify-content: space-between !important;
    }
    
    .qp-z-50 {
      z-index: 2147483647 !important;
    }
    
    /* 主容器样式 */
    .qp-modal-container {
      backdrop-filter: blur(10px) !important;
      background-color: var(--qp-bg-overlay) !important;
      transition: all 0.25s ease-in-out !important;
      width: 100% !important;
      height: 100% !important;
    }

    /* 弹窗主体样式 */
    .qp-modal {
      border-radius: 20px !important;
      overflow: hidden !important;
      background-color: var(--qp-bg-primary) !important;
      border: 1px solid var(--qp-border-color) !important;
      box-shadow: var(--qp-shadow) !important;
      transition: transform 0.25s ease-out, opacity 0.25s ease-out !important;
      transform: translateY(0) scale(1) !important;
      opacity: 1 !important;
      max-width: 660px !important;
      width: 90% !important;
      color: var(--qp-text-primary) !important;
      display: flex !important;
      flex-direction: column !important;
      max-height: 80vh !important;
    }
    
    /* 弹窗头部样式 */
    .qp-modal-header {
      display: flex !important;
      align-items: center !important;
      background: var(--qp-bg-primary) !important;
      padding: 16px !important;
      color: var(--qp-text-primary) !important;
      border-bottom: 1px solid var(--qp-border-color) !important;
      position: relative !important;
    }

    .qp-modal-header::before {
      display: none !important;
    }

    /* 数据统计信息样式 */
    .qp-stats {
      color: rgba(255, 255, 255, 0.85) !important;
      font-size: 12px !important;
      display: flex !important;
      justify-content: space-between !important;
      margin-top: 12px !important;
    }

    /* 底部状态栏样式 */
    .qp-modal-footer {
      padding: 11px 16px !important;
      background-color: var(--qp-bg-secondary) !important;
      border-top: 1px solid var(--qp-border-color) !important;
      color: var(--qp-text-secondary) !important;
      font-size: 12px !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
    }

    .qp-modal-footer span {
      color: var(--qp-text-secondary) !important;
    }

    :host([data-theme='dark']) .qp-modal-footer {
      background-color: var(--qp-bg-secondary) !important;
      border-top: 1px solid rgba(124, 58, 237, 0.1) !important;
    }

    /* 弹窗内容样式 */
    .qp-modal-content {
      padding: 0 !important;
      max-height: none !important;
      background-color: var(--qp-bg-primary) !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      flex: 1 !important;
      min-height: 0 !important;
      position: relative !important;
      overflow-y: auto !important;
      overscroll-behavior: contain !important;
      -webkit-overflow-scrolling: touch !important;
    }

    /* 提示项样式 */
    .qp-prompt-item {
      padding: 14px 18px !important;
      border-left: 2px solid transparent !important;
      transition: all 0.25s ease-out !important;
      border-bottom: 1px solid var(--qp-border-color) !important;
      background-color: var(--qp-bg-primary) !important;
      position: relative !important;
    }

    .qp-prompt-item:last-child {
      border-bottom: none !important;
      margin-bottom: 0 !important;
    }

    /* 只在非键盘导航模式下显示hover效果 */
    :host(:not([data-keyboard-nav])) .qp-prompt-item:hover {
      background-color: var(--qp-bg-hover) !important;
      transform: translateX(1px) !important;
    }

    .qp-prompt-item.qp-selected {
      background-color: var(--qp-bg-selected) !important;
      border-left: 2px solid var(--qp-accent) !important;
      transform: none !important;
      position: relative !important;
    }

    /* 在键盘导航模式下,hover效果被禁用 */
    .qp-keyboard-nav .qp-prompt-item:not(.qp-selected):hover {
      background-color: var(--qp-bg-primary) !important;
      transform: none !important;
    }
    
    /* 提示标题 */
    .qp-prompt-title {
      font-weight: 600 !important;
      font-size: 15px !important;
      color: var(--qp-text-primary) !important;
      margin-bottom: 3px !important;
    }

    /* 提示内容预览 */
    .qp-prompt-preview {
      color: var(--qp-text-secondary) !important;
      font-size: 14px !important;
      line-height: 1.4 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      margin-bottom: 8px !important;
    }

    /* 提示元数据区域（分类和标签） */
    .qp-prompt-meta {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      flex-wrap: wrap !important;
    }

    .qp-attachments {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      flex-wrap: wrap !important;
      margin-bottom: 8px !important;
      max-width: 100% !important;
    }

    .qp-attachment {
      display: inline-flex !important;
      align-items: flex-start !important;
      gap: 6px !important;
      max-width: 260px !important;
      min-width: 0 !important;
      padding: 3px 6px !important;
      border: 1px solid var(--qp-border-color) !important;
      border-radius: 4px !important;
      background-color: var(--qp-bg-secondary) !important;
      color: var(--qp-text-secondary) !important;
    }

    .qp-attachment.qp-attachment-image-only {
      max-width: none !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 4px !important;
      background: transparent !important;
    }

    .qp-attachment-image-button {
      appearance: none !important;
      border: 0 !important;
      background: transparent !important;
      color: inherit !important;
      flex-shrink: 0 !important;
      cursor: zoom-in !important;
      line-height: 0 !important;
      padding: 0 !important;
      border-radius: 4px !important;
    }

    .qp-attachment-image-button:focus-visible {
      outline: 2px solid var(--qp-focus-ring) !important;
      outline-offset: 2px !important;
    }

    .qp-attachment-image {
      width: 72px !important;
      height: 72px !important;
      object-fit: cover !important;
      border-radius: 4px !important;
      border: 0 !important;
      flex-shrink: 0 !important;
      cursor: zoom-in !important;
    }

    .qp-image-viewer {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 16px !important;
      background: rgba(0, 0, 0, 0.82) !important;
      cursor: zoom-out !important;
    }

    .qp-image-viewer-inner {
      position: relative !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      max-width: 100% !important;
      max-height: 100% !important;
      cursor: default !important;
    }

    .qp-image-viewer-image {
      max-width: 90vw !important;
      max-height: 85vh !important;
      object-fit: contain !important;
      border-radius: 8px !important;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35) !important;
      background: #111827 !important;
    }

    .qp-image-viewer-close,
    .qp-image-viewer-nav {
      position: absolute !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 40px !important;
      height: 40px !important;
      border: 0 !important;
      border-radius: 999px !important;
      background: rgba(0, 0, 0, 0.64) !important;
      color: #ffffff !important;
      cursor: pointer !important;
      padding: 8px !important;
    }

    .qp-image-viewer-close:hover,
    .qp-image-viewer-nav:hover {
      background: rgba(0, 0, 0, 0.82) !important;
    }

    .qp-image-viewer-close:focus-visible,
    .qp-image-viewer-nav:focus-visible {
      outline: 2px solid #ffffff !important;
      outline-offset: 2px !important;
    }

    .qp-image-viewer-close {
      top: 8px !important;
      right: 8px !important;
    }

    .qp-image-viewer-nav {
      top: 50% !important;
      transform: translateY(-50%) !important;
    }

    .qp-image-viewer-prev {
      left: 8px !important;
    }

    .qp-image-viewer-next {
      right: 8px !important;
    }

    .qp-image-viewer-close svg,
    .qp-image-viewer-nav svg {
      width: 24px !important;
      height: 24px !important;
      fill: none !important;
      stroke: currentColor !important;
      stroke-width: 2 !important;
      stroke-linecap: round !important;
      stroke-linejoin: round !important;
    }

    .qp-attachment-meta {
      display: flex !important;
      flex-direction: column !important;
      min-width: 0 !important;
      line-height: 1.15 !important;
    }

    .qp-attachment-name {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      color: var(--qp-text-primary) !important;
      font-size: 11px !important;
      font-weight: 500 !important;
    }

    .qp-attachment-size {
      color: var(--qp-text-secondary) !important;
      font-size: 10px !important;
    }

    /* 分类显示 */
    .qp-prompt-category {
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      flex-shrink: 0 !important;
      background-color: var(--qp-bg-secondary) !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      border: 1px solid var(--qp-border-color) !important;
      order: 1 !important;
    }

    .qp-category-dot {
      width: 6px !important;
      height: 6px !important;
      border-radius: 50% !important;
      flex-shrink: 0 !important;
    }

    .qp-category-name {
      font-size: 11px !important;
      font-weight: 500 !important;
      color: var(--qp-text-secondary) !important;
      line-height: 1 !important;
    }

    /* 暗色模式下的分类显示 */
    :host([data-theme="dark"]) .qp-prompt-category {
      background-color: var(--qp-bg-secondary) !important;
      border-color: var(--qp-border-color) !important;
    }

    .qp-character-count {
      display: inline-flex !important;
      align-items: center !important;
      flex-shrink: 0 !important;
      min-height: 19px !important;
      background-color: var(--qp-bg-tag) !important;
      color: var(--qp-text-tag) !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      padding: 2px 7px !important;
      border-radius: 3px !important;
      border: 1px solid transparent !important;
      order: 2 !important;
      white-space: nowrap !important;
    }

    /* 标签样式 */
    .qp-tags-container {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 6px !important;
      order: 3 !important;
    }

    .qp-tag {
      background-color: var(--qp-bg-tag) !important;
      color: var(--qp-text-tag) !important;
      font-size: 11px !important;
      padding: 2px 7px !important;
      border-radius: 3px !important;
      display: inline-flex !important;
      align-items: center !important;
      box-shadow: none !important;
    }

    /* 空状态样式 */
    .qp-empty-state {
      padding: 48px 32px !important;
      text-align: center !important;
      color: var(--qp-text-secondary) !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      background-color: var(--qp-bg-primary) !important;
      flex: 1 !important;
      margin: 0 !important;
    }

    .qp-empty-icon {
      width: 64px !important;
      height: 64px !important;
      margin-bottom: 16px !important;
      opacity: 0.5 !important;
      color: var(--qp-text-secondary) !important;
    }

    .qp-empty-text {
      font-size: 15px !important;
      margin-bottom: 8px !important;
      color: var(--qp-text-primary) !important;
      font-weight: 600 !important;
    }

    .qp-empty-subtext {
      font-size: 13px !important;
      opacity: 0.7 !important;
      color: var(--qp-text-secondary) !important;
    }
    
    /* 确保选中和未选中项的边框一致 */
    .qp-prompt-item,
    .qp-prompt-item.qp-selected {
      border-left-width: 2px !important;
    }

    /* 搜索输入框样式 */
    .qp-search-input {
      border: 1px solid var(--qp-border-color) !important;
      border-radius: 12px !important;
      padding: 11px 14px !important;
      background-color: var(--qp-bg-secondary) !important;
      color: var(--qp-text-primary) !important;
      box-shadow: none !important;
      transition: all 0.18s ease !important;
      font-weight: 500 !important;
      width: 100% !important;
      letter-spacing: 0 !important;
    }

    .qp-search-input::placeholder {
      color: var(--qp-text-secondary) !important;
      font-weight: 400 !important;
    }

    .qp-search-input:hover {
      border-color: var(--qp-focus-ring) !important;
    }

    .qp-search-input:focus {
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14) !important;
      outline: none !important;
    }

    [data-theme='light'] .qp-search-input {
      background-color: rgba(255, 255, 255, 0.95) !important;
      color: #1a1a1a !important;
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.1), inset 0 1px 0 rgba(255, 255, 255, 1), 0 1px 3px rgba(0, 0, 0, 0.05) !important;
      border: 1px solid rgba(124, 58, 237, 0.15) !important;
    }

    :host([data-theme='light']) .qp-search-input::placeholder {
      color: rgba(0, 0, 0, 0.4) !important;
    }

    :host([data-theme='light']) .qp-search-input:hover {
      background-color: #ffffff !important;
      border-color: rgba(124, 58, 237, 0.25) !important;
      box-shadow: 0 6px 16px rgba(124, 58, 237, 0.15), inset 0 1px 0 rgba(255, 255, 255, 1), 0 2px 6px rgba(0, 0, 0, 0.08) !important;
    }

    :host([data-theme='light']) .qp-search-input:focus {
      background-color: #ffffff !important;
      border-color: rgba(124, 58, 237, 0.4) !important;
      box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1), 0 6px 16px rgba(124, 58, 237, 0.15), inset 0 1px 0 rgba(255, 255, 255, 1) !important;
    }
    
    /* 搜索输入框暗黑模式 */
    :host([data-theme='dark']) .qp-search-input {
      background-color: rgba(15, 23, 42, 0.8) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.2) !important;
      color: rgba(255, 255, 255, 0.95) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    :host([data-theme='dark']) .qp-search-input::placeholder {
      color: rgba(255, 255, 255, 0.6) !important;
    }

    :host([data-theme='dark']) .qp-search-input:hover {
      background-color: rgba(15, 23, 42, 0.9) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 2px 6px rgba(0, 0, 0, 0.3) !important;
    }

    :host([data-theme='dark']) .qp-search-input:focus {
      background-color: rgba(15, 23, 42, 0.9) !important;
      border-color: rgba(157, 133, 242, 0.5) !important;
      box-shadow: 0 0 0 3px rgba(157, 133, 242, 0.2), 0 6px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
    }
    
    /* 滚动条样式 */
    .qp-custom-scrollbar {
      scrollbar-width: thin !important;
      scrollbar-color: rgba(0, 0, 0, 0.2) transparent !important;
    }
    
    .qp-custom-scrollbar::-webkit-scrollbar {
      width: 6px !important;
    }
    
    .qp-custom-scrollbar::-webkit-scrollbar-track {
      background: transparent !important;
    }
    
    .qp-custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: rgba(0, 0, 0, 0.2) !important;
      border-radius: 20px !important;
    }
    
    :host([data-theme="dark"]) .qp-custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: rgba(255, 255, 255, 0.2) !important;
    }
    
    .qp-cursor-pointer {
      cursor: pointer !important;
    }

    /* 分类选择器样式 */
    .qp-category-picker {
      position: relative !important;
      width: 152px !important;
      flex: 0 0 152px !important;
    }

    .qp-category-trigger {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      width: 100% !important;
      min-height: 42px !important;
      border: 1px solid var(--qp-border-color) !important;
      border-radius: 8px !important;
      padding: 0 10px 0 12px !important;
      background: var(--qp-bg-secondary) !important;
      color: var(--qp-text-primary) !important;
      box-shadow: none !important;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease !important;
      font-weight: 500 !important;
      font-size: 14px !important;
      letter-spacing: 0 !important;
      cursor: pointer !important;
      outline: none !important;
      text-align: left !important;
    }

    .qp-category-trigger:hover,
    .qp-category-trigger.qp-open {
      border-color: var(--qp-focus-ring) !important;
      background: var(--qp-bg-primary) !important;
    }

    .qp-category-trigger:focus-visible {
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14) !important;
    }

    .qp-category-trigger-label {
      min-width: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .qp-category-trigger-icon {
      width: 16px !important;
      height: 16px !important;
      flex: 0 0 16px !important;
      color: var(--qp-text-secondary) !important;
      transition: transform 0.18s ease !important;
    }

    .qp-category-trigger.qp-open .qp-category-trigger-icon {
      transform: rotate(180deg) !important;
    }

    .qp-category-menu {
      position: absolute !important;
      top: calc(100% + 6px) !important;
      right: 0 !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      width: 220px !important;
      max-height: 260px !important;
      overflow-y: auto !important;
      padding: 6px !important;
      border: 1px solid var(--qp-border-color) !important;
      border-radius: 8px !important;
      background: var(--qp-bg-primary) !important;
      box-shadow: var(--qp-shadow) !important;
    }

    .qp-category-option {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      width: 100% !important;
      min-height: 34px !important;
      border: none !important;
      border-radius: 6px !important;
      padding: 0 8px !important;
      background: transparent !important;
      color: var(--qp-text-primary) !important;
      font-size: 14px !important;
      line-height: 1 !important;
      text-align: left !important;
      cursor: pointer !important;
      outline: none !important;
    }

    .qp-category-option:hover,
    .qp-category-option:focus-visible,
    .qp-category-option.qp-selected {
      background: var(--qp-bg-selected) !important;
    }

    .qp-category-option-dot {
      width: 9px !important;
      height: 9px !important;
      flex: 0 0 9px !important;
      border-radius: 999px !important;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
    }

    .qp-category-option-label {
      flex: 1 !important;
      min-width: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .qp-category-option-check {
      width: 16px !important;
      height: 16px !important;
      flex: 0 0 16px !important;
      color: var(--qp-focus-ring) !important;
    }

    /* 布局相关样式 */
    .qp-w-full {
      width: 100% !important;
    }

    .qp-flex-1 {
      flex: 1 !important;
    }

    .qp-gap-3 {
      gap: 12px !important;
    }

    .qp-space-y-3 > * + * {
      margin-top: 12px !important;
    }

    /* 快捷键提示样式 */
    .qp-shortcut-hints {
      font-size: 11px !important;
      color: rgba(255, 255, 255, 0.75) !important;
      text-align: center !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      gap: 8px !important;
      flex-wrap: wrap !important;
    }

    .qp-hint-item {
      background-color: rgba(255, 255, 255, 0.15) !important;
      padding: 2px 6px !important;
      border-radius: 3px !important;
      font-weight: 500 !important;
      white-space: nowrap !important;
    }

    /* 复制按钮样式 */
    .qp-copy-button {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 6px !important;
      border-radius: 6px !important;
      background: transparent !important;
      border: none !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      color: var(--qp-text-secondary) !important;
    }

    .qp-copy-button:hover {
      background: var(--qp-bg-tag) !important;
      color: var(--qp-text-primary) !important;
    }

    .qp-copy-button.qp-copied {
      color: #10B981 !important;
    }

    .qp-copy-icon {
      width: 18px !important;
      height: 18px !important;
    }

    /* 提示词内容布局 */
    .qp-prompt-body {
      display: flex !important;
      gap: 12px !important;
      align-items: flex-start !important;
    }

    .qp-prompt-body.qp-has-prompt-source-preview {
      justify-content: space-between !important;
    }

    .qp-prompt-content {
      flex: 1 !important;
      min-width: 0 !important;
    }

    .qp-prompt-source-preview-img {
      width: 36px !important;
      height: 36px !important;
      object-fit: cover !important;
      border-radius: 4px !important;
      border: 1px solid var(--qp-border-color) !important;
      flex-shrink: 0 !important;
    }

    :host([data-theme='light']) .qp-search-input,
    :host([data-theme='dark']) .qp-search-input,
    :host([data-theme='light']) .qp-category-trigger,
    :host([data-theme='dark']) .qp-category-trigger {
      background-color: var(--qp-bg-secondary) !important;
      border: 1px solid var(--qp-border-color) !important;
      color: var(--qp-text-primary) !important;
      box-shadow: none !important;
      letter-spacing: 0 !important;
      transform: none !important;
    }

    :host([data-theme='light']) .qp-search-input:hover,
    :host([data-theme='dark']) .qp-search-input:hover,
    :host([data-theme='light']) .qp-category-trigger:hover,
    :host([data-theme='dark']) .qp-category-trigger:hover {
      background-color: var(--qp-bg-secondary) !important;
      border-color: var(--qp-focus-ring) !important;
      box-shadow: none !important;
      transform: none !important;
    }

    :host([data-theme='light']) .qp-search-input:focus,
    :host([data-theme='dark']) .qp-search-input:focus,
    :host([data-theme='light']) .qp-category-trigger:focus-visible,
    :host([data-theme='dark']) .qp-category-trigger:focus-visible {
      background-color: var(--qp-bg-secondary) !important;
      border-color: var(--qp-focus-ring) !important;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14) !important;
      transform: none !important;
    }
  `;
}
