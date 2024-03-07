
//cite: https://stackoverflow.com/a/38157141

navigator.serviceWorker.addEventListener("message", (ev) => {
    if (ev.origin != location.origin) return;
    const msg = ev.data;
    if (msg.name == "localstorage/set") {
        localStorage.setItem(msg.key, msg.value);
    }
    else if (msg.name == "localstorage/get") {
        ev.source.postMessage({
            name: "localstorage/set",
            key: msg.key,
            value: localStorage.getItem(msg.key)
        });
    }
});

//cite: https://medium.com/samsung-internet-dev/pwa-series-service-workers-the-basics-about-offline-a6e8f1d92dfd

if (navigator.serviceWorker.controller != null) {
    console.log("Active service worker found");
}
else {
    navigator.serviceWorker.register("sw.js").then(reg => {
        console.log("Service worker registered");
    });

    navigator.serviceWorker.ready.then((reg) => {
        console.log("Service worker ready");
        reg.active.postMessage({name: "namespace/get"});
    });
}
