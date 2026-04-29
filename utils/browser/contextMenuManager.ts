import { t } from "@/utils/i18n"

const CONTEXT_MENU_ITEMS: Array<Browser.contextMenus.CreateProperties & { titleKey: string }> = [
  {
    id: 'open-options',
    titleKey: 'promptManagement',
    contexts: ['action'],
  },
  {
    id: 'category-management',
    titleKey: 'categoryManagement',
    contexts: ['action'],
  },
  {
    id: 'save-prompt',
    titleKey: 'savePrompt',
    contexts: ['selection'],
  },
];

// Create context menu items
export const createContextMenus = async (): Promise<void> => {
  await browser.contextMenus.removeAll();

  CONTEXT_MENU_ITEMS.forEach(({ titleKey, ...item }) => {
    browser.contextMenus.create({
      ...item,
      title: t(titleKey),
    }, () => {
      const error = browser.runtime.lastError;
      if (error) {
        console.warn(`创建右键菜单失败 (${item.id}):`, error.message);
      }
    });
  });
}

// Handle context menu clicks
export const handleContextMenuClick = async (info: Browser.contextMenus.OnClickData, _tab?: Browser.tabs.Tab): Promise<void> => {
  if (info.menuItemId === 'save-prompt' && info.selectionText) {
    console.log('背景脚本: 右键菜单被点击，选中文本:', info.selectionText)

    // 获取选项页URL
    const optionsUrl = browser.runtime.getURL('/options.html')

    // 添加查询参数，传递选中的文本
    const urlWithParams = `${optionsUrl}?action=new&content=${encodeURIComponent(
      info.selectionText
    )}`

    // 在新标签页打开选项页
    await browser.tabs.create({ url: urlWithParams })
  } else if (info.menuItemId === 'open-options') {
    // 打开选项页
    const optionsUrl = browser.runtime.getURL('/options.html')
    await browser.tabs.create({ url: optionsUrl })
  } else if (info.menuItemId === 'category-management') {
    // 打开分类管理页
    const optionsUrl = browser.runtime.getURL('/options.html#/categories')
    await browser.tabs.create({ url: optionsUrl })
  }
};
