import { CanonicalMedia } from "./local-export";

export const demoItems: CanonicalMedia[] = [
  {
    media_type: "movie",
    source_platform: "douban",
    source_id: "1292052",
    titles: { zh: "肖申克的救赎", en: "The Shawshank Redemption" },
    year: 1994,
    rating: { value: 5, scale: 5 },
    consumed_date: "2024-04-01",
    tags: ["mobile-test", "top250"],
    external_ids: { imdb: "tt0111161" },
  },
  {
    media_type: "movie",
    source_platform: "douban",
    source_id: "1291557",
    titles: { zh: "花样年华", en: "In the Mood for Love" },
    year: 2000,
    rating: { value: 4.5, scale: 5 },
    consumed_date: "2024-04-02",
    tags: ["mobile-test", "hong-kong"],
    external_ids: { imdb: "tt0118694" },
  },
  {
    media_type: "book",
    source_platform: "douban",
    source_id: "2567698",
    titles: { zh: "三体", en: "The Three-Body Problem" },
    year: 2008,
    rating: { value: 5, scale: 5 },
    consumed_date: "2024-04-03",
    tags: ["mobile-test", "sci-fi"],
    external_ids: { isbn: "9787536692930", author: "刘慈欣" },
  },
];
