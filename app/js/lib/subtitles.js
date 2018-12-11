'use strict'

const Subtitles = {
    client: new(require('opensubtitles-api'))({
        useragent: `${Settings.apikeys.opensubtitles} v${PKJSON.version}`
    }),

    getData: (elm) => {
        // extract json from data div
        let id = $(elm).context.id;
        let data = JSON.parse($(`#${id} .data`).text());

        return data;
    },

    search: (opts) => {
        console.info('Looking for subtitles', opts);
        return Subtitles.client.search(opts);
    },

    addSubtitles: (subs, lang) => {
        let language = `<div class="sublanguage tooltipped i18n" title="${i18n.__('Select this language')}">` +
                `<div class="sublang" onClick="Subtitles.expand('${lang}')">${Localization.nativeNames[lang] || subs[0].lang}</div>` +
                `<div class="sublangmenu" id="sub-${lang}"></div>` +
            `</div>`;

        $('#subtitles .subs').append(language);

        for (let n in subs) {
            let id = subs[n].id;
            if ($(`#${id}`)[0]) continue;

            let subtitle = `<div class="sub tooltipped i18n" title="${i18n.__('Load this subtitle')}" id="${id}" onClick="Subtitles.select(this)">` +
                    `<div class="data">${JSON.stringify(subs[n])}</div>` +
                    `<div class="subname">${subs[n].filename}</div>` +
                `</div>`;
            $(`#sub-${lang}`).append(subtitle);

            if (document.getElementById(id).offsetWidth < document.getElementById(id).scrollWidth) {
                $(`#${id}`).addClass('scrolltext');
            }
        }

        $('.sublangmenu').hide();
    },
    expand: (lang) => {
        let $elm = $(`#sub-${lang}`);
        $elm.is(':visible') ? $elm.hide() : $elm.show();
    },
    select: (elm) => {
        let sub = Subtitles.getData(elm);
        let id = sub.id;

        let subtitle = path.join(Cache.dir, sub.filename);

        let selectSubtitle = () => {
            Player.mpv.addSubtitles(subtitle, 'cached', sub.filename, sub.langcode);
            $('#subtitles .sub').removeClass('active');
            $(`#${id}`).addClass('active');

            console.info('Subtitle selected:', sub.langcode);
        }

        if (fs.existsSync(subtitle)) {
            selectSubtitle();
        } else {
            got.stream(sub.url).pipe(fs.createWriteStream(subtitle)).on('finish', selectSubtitle);
        }
    }
}
