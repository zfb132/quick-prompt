export const storage = {
  getItem: async () => undefined,
  setItem: async () => undefined,
}

export const browser = {
  storage: {
    sync: {
      get: async () => ({}),
    },
  },
  i18n: {
    getUILanguage: () => 'en',
  },
}
