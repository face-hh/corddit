

async function pluginInit(page) {
    await page.evaluateOnNewDocument(() => {
        if (window !== window.parent) return;

        const queries = {
            leftSide: "body > shreddit-app > div > div.left-sidebar-min.row-start-1.row-end-auto.invisible.hidden.col-start-1.col-end-1.w-100.s\\:col-start-1.s\\:col-end-4.m\\:block.m\\:visible.relative.border-0.border-solid.s\\:border-r-sm.border-r-neutral-border-weak.isolate",
            upperHeader: "body > shreddit-app > reddit-header-large > header",
            ad: "#t3_15e12ei",
        };

        window.addEventListener('DOMContentLoaded', () => {
            console.log('Going through all keys.')
            for (const key in queries) {
                console.log(`Removing ${key}.`);
                document.querySelector(queries[key]).remove();
            }
        });
    })
}

module.exports = pluginInit;