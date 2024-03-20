
//cite: https://stackoverflow.com/a/38157141

navigator.serviceWorker.addEventListener("message", (ev) => {
    if (ev.origin != location.origin) return;
    const msg = ev.data;
    if (msg.name == "video/set") {
        //if the service worker has no current video
        if (msg.value == null) {
            //if the client has a current video
            const currentVideo = localStorage.getItem(CURRENT_VIDEO);
            if (currentVideo !== null)
                ev.source.postMessage({
                    name: "video/set",
                    value: currentVideo
                });
        }
        else
            localStorage.setItem(CURRENT_VIDEO, msg.value);
    }
    else if (msg.name == "video/get") {
        ev.source.postMessage({
            name: "video/set",
            value: localStorage.getItem(CURRENT_VIDEO)
        });
    }
});

//cite: https://medium.com/samsung-internet-dev/pwa-series-service-workers-the-basics-about-offline-a6e8f1d92dfd

if (navigator.serviceWorker.controller != null) {
    console.log("Active service worker found");
}
else {
    navigator.serviceWorker.register("/sw.js").then(reg => {
        console.log("Service worker registered");
    });

    navigator.serviceWorker.ready.then((reg) => {
        console.log("Service worker ready");
        reg.active.postMessage({name: "video/get"});
    });
}
