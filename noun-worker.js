"use strict";

const KUROMOJI_DIC_PATH = "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/";
const BODY_TOP_N = 15;

const STOP_NOUNS = new Set([
  "こと", "もの", "ため", "よう", "ところ", "わけ", "はず", "つもり", "まま",
  "とき", "時", "方", "他", "私", "自分", "今", "前", "後", "間", "中", "所",
  "点", "場合", "感じ", "意味", "問題", "部分", "状態", "結果", "原因", "関係",
  "予定", "以上", "以下", "これ", "それ", "あれ", "どれ", "こちら", "そちら",
  "みたい", "的", "系", "際", "面", "側", "内", "外", "上", "下",
  "人", "ひと", "者", "性", "化", "度", "用", "版", "さん", "など"
]);

let tokenizer = null;

function isValidNoun(token) {
  if (!token.pos.startsWith("名詞")) return false;
  if (token.pos_detail_1 === "非自立") return false;
  if (token.pos_detail_1 === "代名詞") return false;
  if (token.pos_detail_1 === "数") return false;
  const w = token.surface_form;
  if (!w || STOP_NOUNS.has(w)) return false;
  if (/^[a-zA-Z0-9][a-zA-Z0-9+.#-]*$/.test(w)) return w.length >= 1;
  return w.length >= 2;
}

function collectNouns(text) {
  const nouns = [];
  for (const token of tokenizer.tokenize(text)) {
    if (isValidNoun(token)) nouns.push(token.surface_form);
  }
  return nouns;
}

function extractRepresentativeNouns(title, body) {
  const titleNouns = collectNouns(title || "");
  const freq = new Map();
  for (const token of tokenizer.tokenize(body || "")) {
    if (!isValidNoun(token)) continue;
    const w = token.surface_form;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const bodyTop = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, BODY_TOP_N)
    .map(([w]) => w);
  const seen = new Set();
  const result = [];
  for (const w of [...titleNouns, ...bodyTop]) {
    if (!seen.has(w)) {
      seen.add(w);
      result.push(w);
    }
  }
  return result;
}

self.onmessage = function (e) {
  const { type, id, title, body } = e.data;

  if (type === "init") {
    if (tokenizer) {
      self.postMessage({ type: "ready", id });
      return;
    }
    importScripts("https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js");
    kuromoji.builder({ dicPath: KUROMOJI_DIC_PATH }).build((err, t) => {
      if (err) {
        self.postMessage({ type: "error", id, message: err.message || String(err) });
        return;
      }
      tokenizer = t;
      self.postMessage({ type: "ready", id });
    });
    return;
  }

  if (type === "extract") {
    if (!tokenizer) {
      self.postMessage({ type: "error", id, message: "形態素解析エンジン未初期化" });
      return;
    }
    try {
      const nouns = extractRepresentativeNouns(title, body);
      self.postMessage({ type: "extracted", id, nouns });
    } catch (err) {
      self.postMessage({ type: "error", id, message: err.message || String(err) });
    }
  }
};
