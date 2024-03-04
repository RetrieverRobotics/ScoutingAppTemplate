
//cite: https://medium.com/samsung-internet-dev/pwa-series-service-workers-the-basics-about-offline-a6e8f1d92dfd

if (navigator.serviceWorker.controller) {
    console.log("Active service worker found");
}
else {
    navigator.serviceWorker.register("sw.js").then(reg => {
        console.log("Service worker registered");
    });
}