"use strict";

/*
=========================================================
 RISHI MUSIC
 Complete PWA Music Player
 IndexedDB + Continuous Playback
 Database: RishiMusicDB
 Store: tracks
=========================================================
*/

const DB_NAME = "RishiMusicDB";
const DB_VERSION = 4;
const STORE_NAME = "tracks";

let db = null;
let songs = [];
let currentIndex = -1;
let currentObjectURL = null;

let playQueue = [];
let changingTrack = false;
let automaticNextRunning = false;
let manuallyStopped = false;


/* =========================================================
   HTML ELEMENTS
========================================================= */

const audio = document.getElementById("audioEngine");
const fileInput = document.getElementById("audioFileInput");
const songList = document.getElementById("songListContainer");
const directorFilter = document.getElementById("directorFilter");
const searchInput = document.getElementById("searchInput");

const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const progressBar = document.getElementById("progressBar");
const currentTime = document.getElementById("currentTime");
const totalTime = document.getElementById("totalTime");

const playerTitle = document.getElementById("playerTitle");
const playerArtist = document.getElementById("playerArtist");
const viewTitle = document.getElementById("viewTitle");


/* =========================================================
   SERVICE WORKER
   Registered by index.html.
   No duplicate registration here.
========================================================= */


/* =========================================================
   CUSTOM SONG DETAILS POPUP
========================================================= */

function askSongDetails(defaultTitle) {

    return new Promise(function (resolve) {

        const overlay = document.createElement("div");

        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.background = "rgba(0,0,0,0.78)";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.zIndex = "999999";
        overlay.style.padding = "20px";
        overlay.style.boxSizing = "border-box";

        const box = document.createElement("div");

        box.style.width = "100%";
        box.style.maxWidth = "420px";
        box.style.background =
            "linear-gradient(145deg,#062b63,#03132f)";
        box.style.border =
            "1px solid rgba(0,180,255,0.7)";
        box.style.borderRadius = "20px";
        box.style.padding = "25px";
        box.style.boxShadow =
            "0 0 35px rgba(0,150,255,0.45)";
        box.style.color = "white";
        box.style.boxSizing = "border-box";

        const heading = document.createElement("h2");

        heading.textContent = "Add Song";
        heading.style.marginTop = "0";
        heading.style.textAlign = "center";
        heading.style.color = "#62cfff";

        const titleLabel = document.createElement("label");

        titleLabel.textContent = "Song Name";
        titleLabel.style.display = "block";
        titleLabel.style.marginBottom = "7px";

        const titleInput = document.createElement("input");

        titleInput.type = "text";
        titleInput.value = defaultTitle;
        titleInput.placeholder = "Enter song name";

        titleInput.style.width = "100%";
        titleInput.style.padding = "12px";
        titleInput.style.borderRadius = "10px";
        titleInput.style.border = "1px solid #258cff";
        titleInput.style.background = "#061a38";
        titleInput.style.color = "white";
        titleInput.style.fontSize = "16px";
        titleInput.style.boxSizing = "border-box";
        titleInput.style.marginBottom = "18px";

        const directorLabel = document.createElement("label");

        directorLabel.textContent = "Music Director";
        directorLabel.style.display = "block";
        directorLabel.style.marginBottom = "7px";

        const directorInput = document.createElement("input");

        directorInput.type = "text";
        directorInput.value = "UNKNOWN DIRECTOR";
        directorInput.placeholder = "Enter music director";

        directorInput.style.width = "100%";
        directorInput.style.padding = "12px";
        directorInput.style.borderRadius = "10px";
        directorInput.style.border = "1px solid #258cff";
        directorInput.style.background = "#061a38";
        directorInput.style.color = "white";
        directorInput.style.fontSize = "16px";
        directorInput.style.boxSizing = "border-box";
        directorInput.style.marginBottom = "20px";

        const buttonArea = document.createElement("div");

        buttonArea.style.display = "flex";
        buttonArea.style.gap = "10px";
        buttonArea.style.justifyContent = "flex-end";

        const cancelButton = document.createElement("button");

        cancelButton.textContent = "Cancel";

        cancelButton.style.padding = "11px 18px";
        cancelButton.style.borderRadius = "10px";
        cancelButton.style.border = "none";
        cancelButton.style.cursor = "pointer";

        const saveButton = document.createElement("button");

        saveButton.textContent = "Save Song";

        saveButton.style.padding = "11px 18px";
        saveButton.style.borderRadius = "10px";
        saveButton.style.border = "none";
        saveButton.style.cursor = "pointer";
        saveButton.style.background =
            "linear-gradient(135deg,#008cff,#0055ff)";
        saveButton.style.color = "white";
        saveButton.style.fontWeight = "bold";

        buttonArea.appendChild(cancelButton);
        buttonArea.appendChild(saveButton);

        box.appendChild(heading);
        box.appendChild(titleLabel);
        box.appendChild(titleInput);
        box.appendChild(directorLabel);
        box.appendChild(directorInput);
        box.appendChild(buttonArea);

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        titleInput.focus();
        titleInput.select();

        function close(result) {

            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }

            resolve(result);
        }

        cancelButton.onclick = function () {
            close(null);
        };

        saveButton.onclick = function () {

            const title =
                titleInput.value.trim() ||
                defaultTitle;

            const director =
                directorInput.value.trim() ||
                "UNKNOWN DIRECTOR";

            close({
                title: title,
                director: director
            });
        };

        overlay.onclick = function (event) {

            if (event.target === overlay) {
                close(null);
            }
        };

        titleInput.onkeydown = function (event) {

            if (event.key === "Enter") {
                directorInput.focus();
            }

            if (event.key === "Escape") {
                cancelButton.click();
            }
        };

        directorInput.onkeydown = function (event) {

            if (event.key === "Enter") {
                saveButton.click();
            }

            if (event.key === "Escape") {
                cancelButton.click();
            }
        };
    });
}


/* =========================================================
   DATABASE
========================================================= */

function openDatabase() {

    return new Promise(function (resolve, reject) {

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );

        request.onupgradeneeded = function (event) {

            const database = event.target.result;
            const transaction = event.target.transaction;

            let store;

            if (!database.objectStoreNames.contains(STORE_NAME)) {

                store =
                    database.createObjectStore(
                        STORE_NAME,
                        {
                            keyPath: "id",
                            autoIncrement: true
                        }
                    );

                console.log("Created tracks store.");

            } else {

                store =
                    transaction.objectStore(
                        STORE_NAME
                    );
            }

            /*
             * Preserve legacy stores.
             *
             * IMPORTANT:
             * We do not delete old stores here.
             */

            const oldStores =
                Array.from(
                    database.objectStoreNames
                ).filter(function (name) {

                    return name !== STORE_NAME;
                });

            oldStores.forEach(function (oldName) {

                try {

                    const oldStore =
                        transaction.objectStore(
                            oldName
                        );

                    const cursorRequest =
                        oldStore.openCursor();

                    cursorRequest.onsuccess =
                        function () {

                            const cursor =
                                cursorRequest.result;

                            if (!cursor) {
                                return;
                            }

                            try {

                                const oldSong =
                                    cursor.value;

                                if (
                                    oldSong &&
                                    typeof oldSong === "object"
                                ) {

                                    const copy =
                                        Object.assign(
                                            {},
                                            oldSong
                                        );

                                    /*
                                     * Let tracks generate
                                     * its own ID.
                                     */
                                    delete copy.id;

                                    try {

                                        store.add(copy);

                                    } catch (error) {

                                        console.warn(
                                            "Legacy song copy failed:",
                                            error
                                        );
                                    }
                                }

                            } catch (error) {

                                console.warn(
                                    "Migration error:",
                                    error
                                );
                            }

                            cursor.continue();
                        };

                } catch (error) {

                    console.warn(
                        "Old store error:",
                        error
                    );
                }
            });
        };

        request.onsuccess = function (event) {

            db = event.target.result;

            console.log(
                "RishiMusicDB opened:",
                db.version
            );

            db.onversionchange = function () {

                db.close();

                console.warn(
                    "Database version changed. Reload Rishi Music."
                );
            };

            if (
                !db.objectStoreNames.contains(
                    STORE_NAME
                )
            ) {

                reject(
                    new Error(
                        "tracks object store was not created."
                    )
                );

                return;
            }

            resolve(db);
        };

        request.onerror = function () {

            reject(
                request.error ||
                new Error(
                    "Could not open database."
                )
            );
        };

        request.onblocked = function () {

            reject(
                new Error(
                    "Database is blocked. Close other Rishi Music tabs."
                )
            );
        };
    });
}


async function ensureDatabase() {

    if (
        db &&
        db.objectStoreNames.contains(
            STORE_NAME
        )
    ) {

        return db;
    }

    return await openDatabase();
}


/* =========================================================
   DATABASE OPERATIONS
========================================================= */

function getAllSongs() {

    return new Promise(function (resolve, reject) {

        try {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.getAll();

            request.onsuccess = function () {

                resolve(
                    request.result || []
                );
            };

            request.onerror = function () {

                reject(
                    request.error
                );
            };

        } catch (error) {

            reject(error);
        }
    });
}


function getSong(id) {

    return new Promise(function (resolve, reject) {

        try {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.get(id);

            request.onsuccess = function () {

                resolve(
                    request.result
                );
            };

            request.onerror = function () {

                reject(
                    request.error
                );
            };

        } catch (error) {

            reject(error);
        }
    });
}


function saveSong(song) {

    return new Promise(function (resolve, reject) {

        try {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.add(song);

            request.onsuccess = function (event) {

                resolve(
                    event.target.result
                );
            };

            request.onerror = function () {

                reject(
                    request.error
                );
            };

            transaction.onerror = function () {

                reject(
                    transaction.error
                );
            };

        } catch (error) {

            reject(error);
        }
    });
}


function updateSong(song) {

    return new Promise(function (resolve, reject) {

        try {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.put(song);

            request.onsuccess = function () {
                resolve();
            };

            request.onerror = function () {

                reject(
                    request.error
                );
            };

        } catch (error) {

            reject(error);
        }
    });
}


function deleteSongFromDB(id) {

    return new Promise(function (resolve, reject) {

        try {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.delete(id);

            request.onsuccess = function () {
                resolve();
            };

            request.onerror = function () {

                reject(
                    request.error
                );
            };

        } catch (error) {

            reject(error);
        }
    });
}


/* =========================================================
   SONG INFORMATION
========================================================= */

function getSongTitle(song) {

    return (
        song.title ||
        song.name ||
        song.songName ||
        song.trackName ||
        song.fileName ||
        "Unknown Song"
    );
}


function getSongDirector(song) {

    return (
        song.director ||
        song.musicDirector ||
        song.artist ||
        song.composer ||
        "UNKNOWN DIRECTOR"
    );
}


function getAudioBlob(song) {

    const values = [
        song.blob,
        song.audioBlob,
        song.fileBlob,
        song.audio,
        song.file
    ];

    for (const value of values) {

        if (value instanceof Blob) {
            return value;
        }
    }

    return null;
}


/* =========================================================
   MIME
========================================================= */

function guessMimeType(filename) {

    const ext =
        filename
            .split(".")
            .pop()
            .toLowerCase();

    const types = {

        mp3: "audio/mpeg",
        m4a: "audio/mp4",
        mp4: "audio/mp4",
        wav: "audio/wav",
        ogg: "audio/ogg",
        oga: "audio/ogg",
        opus: "audio/ogg",
        webm: "audio/webm",
        aac: "audio/aac",
        flac: "audio/flac"

    };

    return (
        types[ext] ||
        "audio/mpeg"
    );
}


/* =========================================================
   IMPORT
========================================================= */

fileInput.addEventListener(
    "change",
    async function (event) {

        const files =
            Array.from(
                event.target.files || []
            );

        if (!files.length) {
            return;
        }

        let imported = 0;
        let failed = 0;

        const errors = [];

        try {

            await ensureDatabase();

            for (const file of files) {

                try {

                    if (
                        !file ||
                        file.size <= 0
                    ) {

                        throw new Error(
                            "File is empty."
                        );
                    }

                    const defaultTitle =
                        file.name.replace(
                            /\.[^/.]+$/,
                            ""
                        );

                    const details =
                        await askSongDetails(
                            defaultTitle
                        );

                    if (!details) {
                        continue;
                    }

                    const mime =
                        file.type ||
                        guessMimeType(
                            file.name
                        );

                    const blob =
                        new Blob(
                            [file],
                            {
                                type: mime
                            }
                        );

                    const song = {

                        title:
                            details.title,

                        director:
                            details.director,

                        fileName:
                            file.name,

                        mimeType:
                            mime,

                        size:
                            file.size,

                        blob:
                            blob,

                        addedAt:
                            Date.now(),

                        lastPlayedDate:
                            "",

                        lastPlayedAt:
                            0,

                        playCount:
                            0
                    };

                    await saveSong(song);

                    imported++;

                } catch (error) {

                    failed++;

                    errors.push(
                        file.name +
                        ": " +
                        (
                            error.message ||
                            String(error)
                        )
                    );

                    console.error(
                        "Import failed:",
                        file.name,
                        error
                    );
                }
            }

            fileInput.value = "";

            await reloadLibrary();

            if (imported > 0) {

                let message =
                    imported +
                    (
                        imported === 1
                            ? " song imported successfully."
                            : " songs imported successfully."
                    );

                if (failed > 0) {

                    message +=
                        "\n\nFailed: " +
                        failed;
                }

                alert(message);

            } else if (failed > 0) {

                alert(
                    "NO SONG WAS IMPORTED.\n\n" +
                    errors.join("\n")
                );
            }

        } catch (error) {

            fileInput.value = "";

            console.error(
                "Import system error:",
                error
            );

            alert(
                "Import system error:\n\n" +
                (
                    error.message ||
                    String(error)
                )
            );
        }
    }
);


/* =========================================================
   RELOAD
========================================================= */

async function reloadLibrary() {

    await ensureDatabase();

    songs =
        await getAllSongs();

    songs.sort(
        function (a, b) {

            return getSongTitle(a)
                .localeCompare(
                    getSongTitle(b)
                );
        }
    );

    updateDirectorList();
    renderSongs();

    const songCount =
        document.getElementById(
            "songCount"
        );

    if (songCount) {

        songCount.textContent =
            songs.length +
            (
                songs.length === 1
                    ? " song"
                    : " songs"
            );
    }

    console.log(
        "Total songs:",
        songs.length
    );
}


/* =========================================================
   DIRECTOR LIST
========================================================= */

function updateDirectorList() {

    const previous =
        directorFilter.value ||
        "All";

    const directors = [];

    songs.forEach(function (song) {

        const director =
            getSongDirector(song);

        if (
            !directors.includes(
                director
            )
        ) {

            directors.push(
                director
            );
        }
    });

    directors.sort(
        function (a, b) {
            return a.localeCompare(b);
        }
    );

    directorFilter.innerHTML = "";

    const allOption =
        document.createElement(
            "option"
        );

    allOption.value = "All";
    allOption.textContent =
        "All Directors";

    directorFilter.appendChild(
        allOption
    );

    directors.forEach(function (director) {

        const option =
            document.createElement(
                "option"
            );

        option.value = director;
        option.textContent = director;

        directorFilter.appendChild(
            option
        );
    });

    if (
        previous === "All" ||
        directors.includes(previous)
    ) {

        directorFilter.value =
            previous;

    } else {

        directorFilter.value =
            "All";
    }
}


/* =========================================================
   DATE / DAILY PLAY
========================================================= */

function todayKey() {

    const date = new Date();

    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            date.getDate()
        ).padStart(2, "0")
    );
}


function playedToday(song) {

    return (
        song.lastPlayedDate ===
        todayKey()
    );
}


async function markPlayed(song) {

    song.lastPlayedDate =
        todayKey();

    song.lastPlayedAt =
        Date.now();

    song.playCount =
        Number(
            song.playCount || 0
        ) + 1;

    await updateSong(song);
}


/* =========================================================
   RENDER
========================================================= */

function renderSongs() {

    songList.innerHTML = "";

    const selected =
        directorFilter.value ||
        "All";

    const search =
        searchInput.value
            .trim()
            .toLowerCase();

    const visible =
        songs.filter(function (song) {

            const title =
                getSongTitle(song)
                    .toLowerCase();

            const director =
                getSongDirector(song);

            return (

                (
                    selected === "All" ||
                    director === selected
                )

                &&

                (
                    search === "" ||
                    title.includes(search)
                )
            );
        });

    if (!visible.length) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "song-item";

        empty.textContent =
            songs.length === 0
                ? "No songs imported yet."
                : "No songs found.";

        songList.appendChild(empty);

        return;
    }

    visible.forEach(function (song) {

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "song-item";

        const info =
            document.createElement(
                "div"
            );

        info.className =
            "song-info";

        const title =
            document.createElement(
                "div"
            );

        title.className =
            "song-title";

        title.textContent =
            getSongTitle(song);

        const director =
            document.createElement(
                "div"
            );

        director.className =
            "song-director";

        director.textContent =
            getSongDirector(song);

        info.appendChild(title);
        info.appendChild(director);

        if (playedToday(song)) {

            const played =
                document.createElement(
                    "div"
                );

            played.className =
                "played-today";

            played.textContent =
                "✓ PLAYED TODAY";

            info.appendChild(
                played
            );
        }

        const buttons =
            document.createElement(
                "div"
            );

        buttons.className =
            "song-buttons";

        const play =
            document.createElement(
                "button"
            );

        play.textContent = "▶";
        play.title = "Play";

        play.onclick =
            function (event) {

                event.stopPropagation();

                manuallyStopped = false;

                playSongByID(
                    song.id
                );
            };

        const edit =
            document.createElement(
                "button"
            );

        edit.textContent = "✎";
        edit.title = "Edit";

        edit.onclick =
            function (event) {

                event.stopPropagation();

                editSong(
                    song.id
                );
            };

        const remove =
            document.createElement(
                "button"
            );

        remove.textContent = "🗑";
        remove.title = "Delete";

        remove.onclick =
            function (event) {

                event.stopPropagation();

                deleteSong(
                    song.id
                );
            };

        buttons.appendChild(play);
        buttons.appendChild(edit);
        buttons.appendChild(remove);

        item.appendChild(info);
        item.appendChild(buttons);

        item.onclick =
            function () {

                manuallyStopped = false;

                playSongByID(
                    song.id
                );
            };

        songList.appendChild(item);
    });
}


/* =========================================================
   PLAY SONG
========================================================= */

async function playSongByID(id) {

    const index =
        songs.findIndex(
            function (song) {

                return String(song.id) ===
                    String(id);
            }
        );

    if (index === -1) {
        return;
    }

    playQueue =
        playQueue.filter(
            function (queueID) {

                return String(queueID) !==
                    String(id);
            }
        );

    await playSongAtIndex(index);
}


async function playSongAtIndex(index) {

    if (changingTrack) {
        return false;
    }

    if (
        index < 0 ||
        index >= songs.length
    ) {
        return false;
    }

    changingTrack = true;

    try {

        const song =
            await getSong(
                songs[index].id
            );

        if (!song) {

            throw new Error(
                "Song not found in database."
            );
        }

        const blob =
            getAudioBlob(song);

        if (!blob) {

            throw new Error(
                "Audio data is missing."
            );
        }

        audio.pause();

        audio.removeAttribute(
            "src"
        );

        audio.load();

        if (currentObjectURL) {

            URL.revokeObjectURL(
                currentObjectURL
            );

            currentObjectURL = null;
        }

        currentObjectURL =
            URL.createObjectURL(
                blob
            );

        audio.src =
            currentObjectURL;

        currentIndex =
            index;

        manuallyStopped = false;

        playerTitle.textContent =
            getSongTitle(song);

        playerArtist.textContent =
            getSongDirector(song);

        progressBar.value = 0;

        currentTime.textContent =
            "0:00";

        totalTime.textContent =
            "0:00";

        setupMediaSession(song);

        /*
         * Mark as played after the track
         * has been selected.
         */

        await markPlayed(song);

        songs[index] = song;

        renderSongs();

        /*
         * Important:
         * wait for the new audio source
         * before starting playback.
         */

        await waitForAudioReady();

        await audio.play();

        return true;

    } catch (error) {

        console.error(
            "Playback error:",
            error
        );

        playerTitle.textContent =
            "Playback error";

        playerArtist.textContent =
            error.message ||
            "Unable to play this song.";

        return false;

    } finally {

        changingTrack = false;
    }
}


/* =========================================================
   WAIT FOR AUDIO READY
========================================================= */

function waitForAudioReady() {

    return new Promise(function (resolve, reject) {

        if (
            audio.readyState >= 2
        ) {

            resolve();
            return;
        }

        let finished = false;

        const timeout =
            setTimeout(
                function () {

                    if (finished) {
                        return;
                    }

                    finished = true;

                    cleanup();

                    reject(
                        new Error(
                            "Audio could not be loaded."
                        )
                    );

                },
                15000
            );

        function cleanup() {

            clearTimeout(timeout);

            audio.removeEventListener(
                "canplay",
                success
            );

            audio.removeEventListener(
                "error",
                failure
            );
        }

        function success() {

            if (finished) {
                return;
            }

            finished = true;

            cleanup();

            resolve();
        }

        function failure() {

            if (finished) {
                return;
            }

            finished = true;

            cleanup();

            reject(
                new Error(
                    "Audio file could not be decoded."
                )
            );
        }

        audio.addEventListener(
            "canplay",
            success
        );

        audio.addEventListener(
            "error",
            failure
        );
    });
}


/* =========================================================
   BUILD PLAY QUEUE
========================================================= */

function buildPlayQueue() {

    const selected =
        directorFilter.value ||
        "All";

    const search =
        searchInput.value
            .trim()
            .toLowerCase();

    let available =
        songs.filter(
            function (song) {

                const title =
                    getSongTitle(song)
                        .toLowerCase();

                const director =
                    getSongDirector(song);

                return (

                    (
                        selected === "All" ||
                        director === selected
                    )

                    &&

                    (
                        search === "" ||
                        title.includes(search)
                    )

                    &&

                    !playedToday(song)
                );
            }
        );

    /*
     * Shuffle.
     */

    for (
        let i = available.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            available[i],
            available[j]
        ] =
        [
            available[j],
            available[i]
        ];
    }

    /*
     * Mix directors.
     */

    const mixed = [];

    let previousDirector = "";

    while (available.length) {

        let position =
            available.findIndex(
                function (song) {

                    return (
                        getSongDirector(song) !==
                        previousDirector
                    );
                }
            );

        if (position === -1) {
            position = 0;
        }

        const selectedSong =
            available.splice(
                position,
                1
            )[0];

        mixed.push(
            selectedSong.id
        );

        previousDirector =
            getSongDirector(
                selectedSong
            );
    }

    playQueue =
        mixed;
}


/* =========================================================
   GET NEXT SONG
========================================================= */

function getNextSongID() {

    while (playQueue.length > 0) {

        const id =
            playQueue.shift();

        const song =
            songs.find(
                function (item) {

                    return String(item.id) ===
                        String(id);
                }
            );

        if (!song) {
            continue;
        }

        if (playedToday(song)) {
            continue;
        }

        return song.id;
    }

    return null;
}


/* =========================================================
   AUTOMATIC NEXT SONG
========================================================= */

async function playNextSong() {

    /*
     * Prevent two ended/error events from
     * starting two songs at the same time.
     */

    if (automaticNextRunning) {
        return;
    }

    automaticNextRunning = true;

    try {

        if (songs.length === 0) {
            return;
        }

        /*
         * First use the existing queue.
         */

        let nextID =
            getNextSongID();

        /*
         * If queue is empty, create
         * a fresh queue.
         */

        if (nextID === null) {

            buildPlayQueue();

            nextID =
                getNextSongID();
        }

        /*
         * If everything has been played
         * today, reset today's cycle.
         *
         * This makes continuous playback
         * continue instead of stopping.
         */

        if (nextID === null) {

            console.log(
                "Daily queue completed. Starting a new cycle."
            );

            songs.forEach(function (song) {

                song.lastPlayedDate = "";

            });

            /*
             * We only change the in-memory
             * daily markers here and rebuild.
             * The songs themselves remain intact.
             */

            buildPlayQueue();

            nextID =
                getNextSongID();
        }

        if (nextID === null) {

            playerTitle.textContent =
                "No playable songs";

            playerArtist.textContent =
                "Import an audio file";

            return;
        }

        const success =
            await playSongByID(
                nextID
            );

        /*
         * If one song fails, automatically
         * try another song instead of stopping.
         */

        if (success === false) {

            console.warn(
                "Track failed. Trying another song."
            );

            setTimeout(
                function () {

                    automaticNextRunning = false;

                    playNextSong();

                },
                250
            );

            return;
        }

    } finally {

        /*
         * Keep this false after the track
         * has successfully started.
         */

        automaticNextRunning = false;
    }
}


/* =========================================================
   PREVIOUS
========================================================= */

async function playPreviousSong() {

    if (!songs.length) {
        return;
    }

    let index =
        currentIndex - 1;

    if (index < 0) {
        index =
            songs.length - 1;
    }

    manuallyStopped = false;

    await playSongAtIndex(index);
}


/* =========================================================
   PLAY / PAUSE
========================================================= */

playBtn.addEventListener(
    "click",
    async function () {

        if (currentIndex === -1) {

            manuallyStopped = false;

            await playNextSong();

            return;
        }

        if (audio.paused) {

            manuallyStopped = false;

            try {

                await audio.play();

            } catch (error) {

                console.error(
                    "Resume error:",
                    error
                );
            }

        } else {

            /*
             * This is a manual pause.
             * It must NOT automatically
             * start the next song.
             */

            manuallyStopped = true;

            audio.pause();
        }
    }
);


/* =========================================================
   NEXT / PREVIOUS BUTTONS
========================================================= */

nextBtn.addEventListener(
    "click",
    async function () {

        manuallyStopped = false;

        await playNextSong();
    }
);


prevBtn.addEventListener(
    "click",
    async function () {

        manuallyStopped = false;

        await playPreviousSong();
    }
);


/* =========================================================
   IMPORTANT AUTOMATIC NEXT HANDLER
========================================================= */

audio.addEventListener(
    "ended",
    async function () {

        console.log(
            "Song ended. Automatically starting next song..."
        );

        /*
         * If user intentionally stopped playback,
         * do nothing.
         */

        if (manuallyStopped) {
            return;
        }

        /*
         * Reset audio state.
         */

        audio.currentTime = 0;

        await playNextSong();
    }
);


/* =========================================================
   AUDIO ERROR RECOVERY
========================================================= */

audio.addEventListener(
    "error",
    function () {

        /*
         * Ignore errors when no song is loaded.
         */

        if (currentIndex === -1) {
            return;
        }

        const mediaError =
            audio.error;

        console.warn(
            "Audio error:",
            mediaError
        );

        /*
         * If the current track genuinely
         * cannot be played, move forward.
         */

        if (!manuallyStopped) {

            setTimeout(
                function () {

                    playNextSong();

                },
                300
            );
        }
    }
);


/* =========================================================
   PLAY / PAUSE UI
========================================================= */

audio.addEventListener(
    "play",
    function () {

        playBtn.textContent =
            "⏸";
    }
);


audio.addEventListener(
    "pause",
    function () {

        playBtn.textContent =
            "▶";
    }
);


/* =========================================================
   METADATA
========================================================= */

audio.addEventListener(
    "loadedmetadata",
    function () {

        if (
            Number.isFinite(
                audio.duration
            )
        ) {

            progressBar.max =
                audio.duration;

            totalTime.textContent =
                formatTime(
                    audio.duration
                );
        }
    }
);


/* =========================================================
   TIME
========================================================= */

audio.addEventListener(
    "timeupdate",
    function () {

        if (
            !Number.isFinite(
                audio.duration
            )
        ) {
            return;
        }

        progressBar.max =
            audio.duration;

        progressBar.value =
            audio.currentTime;

        currentTime.textContent =
            formatTime(
                audio.currentTime
            );

        totalTime.textContent =
            formatTime(
                audio.duration
            );
    }
);


/* =========================================================
   PROGRESS
========================================================= */

progressBar.addEventListener(
    "input",
    function () {

        if (
            Number.isFinite(
                audio.duration
            )
        ) {

            audio.currentTime =
                Number(
                    progressBar.value
                );
        }
    }
);


/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(seconds) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {

        return "0:00";
    }

    const total =
        Math.floor(seconds);

    const minutes =
        Math.floor(
            total / 60
        );

    const secondsPart =
        total % 60;

    return (
        minutes +
        ":" +
        String(
            secondsPart
        ).padStart(
            2,
            "0"
        )
    );
}


/* =========================================================
   SEARCH
========================================================= */

searchInput.addEventListener(
    "input",
    function () {

        playQueue = [];

        renderSongs();

        buildPlayQueue();
    }
);


/* =========================================================
   DIRECTOR FILTER
========================================================= */

directorFilter.addEventListener(
    "change",
    function () {

        playQueue = [];

        if (viewTitle) {

            viewTitle.textContent =
                directorFilter.value === "All"
                    ? "All Songs"
                    : directorFilter.value;
        }

        renderSongs();

        buildPlayQueue();
    }
);


/* =========================================================
   EDIT SONG
========================================================= */

async function editSong(id) {

    const song =
        await getSong(id);

    if (!song) {
        return;
    }

    const result =
        await askEditDetails(
            getSongTitle(song),
            getSongDirector(song)
        );

    if (!result) {
        return;
    }

    song.title =
        result.title;

    song.director =
        result.director;

    await updateSong(song);

    await reloadLibrary();

    buildPlayQueue();
}


/* =========================================================
   EDIT POPUP
========================================================= */

function askEditDetails(
    title,
    director
) {

    return new Promise(function (resolve) {

        const overlay =
            document.createElement("div");

        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.background =
            "rgba(0,0,0,0.78)";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.zIndex = "999999";
        overlay.style.padding = "20px";

        const box =
            document.createElement("div");

        box.style.width = "100%";
        box.style.maxWidth = "420px";
        box.style.background =
            "linear-gradient(145deg,#062b63,#03132f)";
        box.style.padding = "25px";
        box.style.borderRadius = "20px";
        box.style.color = "white";
        box.style.boxShadow =
            "0 0 35px rgba(0,150,255,0.45)";

        const heading =
            document.createElement("h2");

        heading.textContent =
            "Edit Song";

        const titleLabel =
            document.createElement("div");

        titleLabel.textContent =
            "Song Name";

        titleLabel.style.marginBottom =
            "6px";

        const titleInput =
            document.createElement("input");

        titleInput.value =
            title;

        titleInput.style.width =
            "100%";

        titleInput.style.padding =
            "12px";

        titleInput.style.boxSizing =
            "border-box";

        titleInput.style.marginBottom =
            "14px";

        const directorLabel =
            document.createElement("div");

        directorLabel.textContent =
            "Music Director";

        directorLabel.style.marginBottom =
            "6px";

        const directorInput =
            document.createElement("input");

        directorInput.value =
            director;

        directorInput.style.width =
            "100%";

        directorInput.style.padding =
            "12px";

        directorInput.style.boxSizing =
            "border-box";

        const buttons =
            document.createElement("div");

        buttons.style.marginTop =
            "20px";

        buttons.style.display =
            "flex";

        buttons.style.gap =
            "10px";

        const cancel =
            document.createElement("button");

        cancel.textContent =
            "Cancel";

        const save =
            document.createElement("button");

        save.textContent =
            "Save";

        buttons.appendChild(cancel);
        buttons.appendChild(save);

        box.appendChild(heading);
        box.appendChild(titleLabel);
        box.appendChild(titleInput);
        box.appendChild(directorLabel);
        box.appendChild(directorInput);
        box.appendChild(buttons);

        overlay.appendChild(box);

        document.body.appendChild(
            overlay
        );

        titleInput.focus();

        save.onclick =
            function () {

                const newTitle =
                    titleInput.value.trim();

                const newDirector =
                    directorInput.value.trim();

                if (!newTitle) {
                    return;
                }

                overlay.remove();

                resolve({
                    title: newTitle,
                    director:
                        newDirector ||
                        "UNKNOWN DIRECTOR"
                });
            };

        cancel.onclick =
            function () {

                overlay.remove();

                resolve(null);
            };

        overlay.onclick =
            function (event) {

                if (
                    event.target === overlay
                ) {

                    overlay.remove();

                    resolve(null);
                }
            };
    });
}


/* =========================================================
   DELETE
========================================================= */

async function deleteSong(id) {

    const song =
        await getSong(id);

    if (!song) {
        return;
    }

    if (
        !confirm(
            'Delete "' +
            getSongTitle(song) +
            '"?'
        )
    ) {

        return;
    }

    await deleteSongFromDB(id);

    if (
        currentIndex >= 0 &&
        songs[currentIndex] &&
        String(
            songs[currentIndex].id
        ) === String(id)
    ) {

        manuallyStopped = true;

        audio.pause();

        audio.removeAttribute(
            "src"
        );

        audio.load();

        if (currentObjectURL) {

            URL.revokeObjectURL(
                currentObjectURL
            );

            currentObjectURL =
                null;
        }

        currentIndex = -1;

        playerTitle.textContent =
            "No track playing";

        playerArtist.textContent =
            "Select a song from your library";
    }

    playQueue = [];

    await reloadLibrary();

    buildPlayQueue();
}


/* =========================================================
   MEDIA SESSION
========================================================= */

function setupMediaSession(song) {

    if (
        !("mediaSession" in navigator)
    ) {
        return;
    }

    try {

        navigator.mediaSession.metadata =
            new MediaMetadata({

                title:
                    getSongTitle(song),

                artist:
                    getSongDirector(song),

                album:
                    "Rishi Music"
            });

    } catch (error) {

        console.warn(
            "Media metadata error:",
            error
        );
    }

    const handlers = {

        play: function () {

            manuallyStopped = false;

            return audio.play();
        },

        pause: function () {

            manuallyStopped = true;

            audio.pause();
        },

        nexttrack: function () {

            manuallyStopped = false;

            return playNextSong();
        },

        previoustrack: function () {

            manuallyStopped = false;

            return playPreviousSong();
        },

        seekbackward: function () {

            audio.currentTime =
                Math.max(
                    0,
                    audio.currentTime - 10
                );
        },

        seekforward: function () {

            audio.currentTime =
                Math.min(
                    audio.duration || Infinity,
                    audio.currentTime + 10
                );
        }
    };

    Object.keys(handlers).forEach(
        function (action) {

            try {

                navigator.mediaSession
                    .setActionHandler(
                        action,
                        handlers[action]
                    );

            } catch (error) {

                console.warn(
                    "Media action unsupported:",
                    action
                );
            }
        }
    );
}


/* =========================================================
   PERSISTENT STORAGE
========================================================= */

async function requestPersistentStorage() {

    if (
        navigator.storage &&
        navigator.storage.persist
    ) {

        try {

            const result =
                await navigator.storage.persist();

            console.log(
                "Persistent storage:",
                result
            );

        } catch (error) {

            console.warn(
                "Persistent storage error:",
                error
            );
        }
    }
}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        if (currentObjectURL) {

            URL.revokeObjectURL(
                currentObjectURL
            );

            currentObjectURL =
                null;
        }
    }
);


/* =========================================================
   START
========================================================= */

async function startRishiMusic() {

    try {

        await openDatabase();

        await requestPersistentStorage();

        await reloadLibrary();

        buildPlayQueue();

        console.log(
            "================================"
        );

        console.log(
            "RISHI MUSIC READY"
        );

        console.log(
            "Database:",
            DB_NAME
        );

        console.log(
            "Version:",
            db.version
        );

        console.log(
            "Store:",
            STORE_NAME
        );

        console.log(
            "Songs:",
            songs.length
        );

        console.log(
            "Continuous playback: ENABLED"
        );

        console.log(
            "================================"
        );

    } catch (error) {

        console.error(
            "Rishi Music startup error:",
            error
        );

        alert(
            "Rishi Music could not start.\n\n" +
            (
                error.message ||
                String(error)
            )
        );
    }
}


startRishiMusic();
