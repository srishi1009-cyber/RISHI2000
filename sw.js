const CACHE_NAME = "rishi-music-v8";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];


// ========================================
// INSTALL
// ========================================

self.addEventListener("install", function (event) {

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(function (cache) {

        return Promise.all(

          APP_FILES.map(function (file) {

            return fetch(file, {
              cache: "no-store"
            })

            .then(function (response) {

              if (!response.ok) {
                throw new Error(
                  "Failed to cache " + file
                );
              }

              return cache.put(
                file,
                response
              );

            })

            .catch(function (error) {

              console.warn(
                "Could not cache:",
                file,
                error
              );

            });

          })

        );

      })

      .then(function () {

        return self.skipWaiting();

      })

  );

});


// ========================================
// ACTIVATE
// ========================================

self.addEventListener("activate", function (event) {

  event.waitUntil(

    caches.keys()

      .then(function (cacheNames) {

        return Promise.all(

          cacheNames.map(function (cacheName) {

            if (
              cacheName.startsWith("rishi-music-") &&
              cacheName !== CACHE_NAME
            ) {

              return caches.delete(cacheName);

            }

            return null;

          })

        );

      })

      .then(function () {

        return self.clients.claim();

      })

  );

});


// ========================================
// FETCH
// ========================================

self.addEventListener("fetch", function (event) {

  const request = event.request;

  if (request.method !== "GET") {
    return;
  }


  if (request.url.startsWith("blob:")) {
    return;
  }


  const url = new URL(request.url);


  if (url.origin !== self.location.origin) {
    return;
  }


  event.respondWith(

    fetch(request)

      .then(function (response) {

        if (
          response &&
          response.ok &&
          request.url.includes("/RISHI2000/")
        ) {

          const copy = response.clone();

          caches.open(CACHE_NAME)

            .then(function (cache) {

              cache.put(
                request,
                copy
              );

            })

            .catch(function () {});

        }

        return response;

      })

      .catch(function () {

        return caches.match(request)

          .then(function (cached) {

            if (cached) {
              return cached;
            }

            return caches.match(
              "./index.html"
            );

          });

      })

  );

});
