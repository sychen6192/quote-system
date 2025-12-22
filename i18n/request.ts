import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'zh-TW'];

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    if (!locale || !locales.includes(locale as string)) {
        locale = 'zh-TW';
    }

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default
    };
});