import fetch from 'node-fetch';
import { mapp, reverse, subst_, subst, rc4, debug, try_stream, get_keys } from '../utils.js';
import { F2Cloud } from '../providers/f2cloud.js';
import { FMCloud } from '../providers/fmcloud.js';

export class Aniwave {

  static HOST = 'aniwave.to';
  static ALT_HOSTS = [Aniwave.HOST];
  static SERVER_F2CLOUD = 41;
  static SERVER_MEGACLOUD = 28;
  static SERVER_FMCLOUD = 45;
  static SERVERS = [
    { id: Aniwave.SERVER_F2CLOUD, handler: F2Cloud },
    { id: Aniwave.SERVER_MEGACLOUD, handler: F2Cloud },
    { id: Aniwave.SERVER_FMCLOUD, handler: FMCloud },
  ]
  static ID = "AW";

  static SCRAPE_CONFIG = {
    ID: Aniwave.ID,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36; PlayStation',
    EXPECTED_KEYS: 18,
    INJECT_URLS: [
      "all.js",
      "embed.js",
      "scripts.js"
    ],
    INIT_URL: "https://aniwave.to/watch/one-piece.x3ln/ep-1",
    BTN_ID: "#player-wrapper",
    MAX_TIMEOUT: 2500
  }

  static enc(a) {
    let keys = get_keys(Aniwave.ALT_HOSTS);
    a = reverse(subst(rc4(keys[2], mapp(a, keys[0], keys[1]))));
    a = mapp(subst(rc4(keys[3], reverse(a))), keys[4], keys[5]);
    a = subst(rc4(keys[8], reverse(mapp(a, keys[6], keys[7]))));
    return a = subst(a);
  }
  static dec(a) {
    let keys = get_keys(Aniwave.ALT_HOSTS);
    a = subst_(a);
    a = mapp(reverse(rc4(keys[8], subst_(a))), keys[7], keys[6]);
    a = reverse(rc4(keys[3], subst_(mapp(a, keys[5], keys[4]))));
    return a = mapp(rc4(keys[2], subst_(reverse(a))), keys[1], keys[0]);
  }

  static async episode(data_id, server = Aniwave.SERVER_F2CLOUD) {
    let url = `https://${Aniwave.HOST}/ajax/server/list/${data_id}?vrf=${encodeURIComponent(Aniwave.enc(data_id))}`;
    let resp = await (await fetch(url)).json();
    data_id = (new RegExp(`data-sv-id="${server}" data-link-id="(.*?)"`)).exec(resp["result"])[1];
    url = `https://${Aniwave.HOST}/ajax/server/${data_id}?vrf=${encodeURIComponent(Aniwave.enc(data_id))}`;
    resp = await (await fetch(url)).json();
    let url_dec = Aniwave.dec(resp["result"]["url"]);
    return await try_stream(Aniwave.SERVERS, server, url_dec);
  }

  static async movie(id, server = Aniwave.SERVER_F2CLOUD) {
    return await Aniwave.tv(id, 1, server);
  }

  static async tv(id, e = 1, server = Aniwave.SERVER_F2CLOUD) {
    let resp = await (await fetch(`https://${Aniwave.HOST}/watch/${id}/ep-${e}`)).text();
    let data_id = (/data-id="(.*?)"/g).exec(resp)[1];
    debug(Aniwave.ID, data_id);
    const url = `https://${Aniwave.HOST}/ajax/episode/list/${data_id}?vrf=${encodeURIComponent(Aniwave.enc(data_id))}`
    debug(Aniwave.ID, url);
    resp = await (await fetch(url)).json();
    data_id = (new RegExp(`data-num="${e}".*?data-ids="(.*?)"`, 'g')).exec(resp["result"])[1];
    debug(Aniwave.ID, data_id);
    return await Aniwave.episode(data_id, server);
  }

  static async search(query) {
    let url = `https://${Aniwave.HOST}/filter?keyword=${query}`;
    let resp = await (await fetch(url)).text();
    let results = resp.match(new RegExp(`<a class="name d-title" href=".*?">.*?</a>`, 'g'));
    let ret = [];
    for (let r of results) {
      let [, type, id, title] = (new RegExp(`href="/(.*?)/(.*?)" .*>(.*?)</a>`)).exec(r);
      ret.push({ type, title, id });
    }
    return ret;
  }

  static async test() {
    console.log(await Aniwave.tv("one-piece.x3ln", 1));
    let results = (await Aniwave.search("one piece"));
    if (results[0].type == 'tv')
      console.log(await Aniwave.tv(results[0].id, 1));
    else
      console.log(await Aniwave.movie(results[0].id));
  }
}