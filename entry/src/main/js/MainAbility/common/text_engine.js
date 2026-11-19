/**
 * Bộ xử lý tách dòng thông minh (Anti-Truncation Text Engine) cho Huawei Watch Fit 3.
 * Lưu ý quan trọng: JerryScript trên Lite Wearable KHÔNG hỗ trợ Regular Expression (/.../),
 * nên mọi xử lý chuỗi tại đây đều dùng các hàm chuẩn (split, join, indexOf, charCodeAt)
 * để đảm bảo chạy 100% trên cả Previewer và đồng hồ thật.
 */

var NARROW_CHARS = "iljtfrI1.,!:;'|()[]-` ";
var WIDE_LOWER_CHARS = "mw";
var WIDE_UPPER_CHARS = "MWĐƯƠ";

var FONT_PRESETS = [
  {
    level: 0,
    label: "Nhỏ",
    shortLabel: "A-",
    bodyFontSize: 23,
    titleFontSize: 25,
    lineHeight: 36,
    titleLineHeight: 40,
    maxBodyUnits: 15.2,
    maxTitleUnits: 13.8
  },
  {
    level: 1,
    label: "Vừa",
    shortLabel: "A",
    bodyFontSize: 27,
    titleFontSize: 29,
    lineHeight: 42,
    titleLineHeight: 46,
    maxBodyUnits: 12.8,
    maxTitleUnits: 11.8
  },
  {
    level: 2,
    label: "To",
    shortLabel: "A+",
    bodyFontSize: 31,
    titleFontSize: 33,
    lineHeight: 48,
    titleLineHeight: 52,
    maxBodyUnits: 10.9,
    maxTitleUnits: 10.0
  }
];

function getFontPreset(level) {
  var idx = Number(level);
  if (isNaN(idx) || idx < 0 || idx >= FONT_PRESETS.length) {
    idx = 1;
  }
  return FONT_PRESETS[idx];
}

function getCharUnitWidth(ch) {
  if (!ch) {
    return 0;
  }
  if (ch === "\t") {
    return 1.2;
  }
  if (NARROW_CHARS.indexOf(ch) !== -1) {
    return 0.42;
  }
  if (WIDE_LOWER_CHARS.indexOf(ch) !== -1) {
    return 0.88;
  }
  if (WIDE_UPPER_CHARS.indexOf(ch) !== -1) {
    return 0.96;
  }
  var code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) {
    return 0.78;
  }
  if ((code >= 48 && code <= 57) || (code >= 97 && code <= 122)) {
    return 0.62;
  }
  if (code >= 0x00C0 && code <= 0x1EFF) {
    var upper = ch.toUpperCase();
    if (ch === upper && ch !== ch.toLowerCase()) {
      return 0.82;
    }
    return 0.65;
  }
  if (code >= 0x2000) {
    return 1.05;
  }
  return 0.68;
}

function measureStringUnits(str) {
  if (!str) {
    return 0;
  }
  var total = 0;
  for (var i = 0; i < str.length; i++) {
    total += getCharUnitWidth(str.charAt(i));
  }
  return total;
}

function isBlankString(str) {
  if (!str) {
    return true;
  }
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    if (c !== " " && c !== "\t" && c !== "\r" && c !== "\n") {
      return false;
    }
  }
  return true;
}

function splitOversizedWord(word, maxUnits) {
  var chunks = [];
  var current = "";
  var currentUnits = 0;

  for (var i = 0; i < word.length; i++) {
    var ch = word.charAt(i);
    var chUnits = getCharUnitWidth(ch);
    if (current.length > 0 && (currentUnits + chUnits > maxUnits)) {
      chunks.push(current);
      current = ch;
      currentUnits = chUnits;
    } else {
      current += ch;
      currentUnits += chUnits;
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function wrapTextToLines(rawText, maxUnits) {
  if (rawText === undefined || rawText === null) {
    return ["(Trống)"];
  }
  var text = String(rawText);
  if (text.length === 0) {
    return ["(Trống)"];
  }

  var limit = maxUnits || 12.5;
  var normalized = text.split("\r\n").join("\n").split("\r").join("\n");
  var paragraphs = normalized.split("\n");
  var resultLines = [];
  var spaceUnits = getCharUnitWidth(" ");

  for (var p = 0; p < paragraphs.length; p++) {
    var para = paragraphs[p];
    if (isBlankString(para)) {
      resultLines.push(" ");
      continue;
    }

    var words = para.split(" ");
    var currentLine = "";
    var currentUnits = 0;

    for (var w = 0; w < words.length; w++) {
      var word = words[w];
      if (word.length === 0) {
        continue;
      }

      var wordUnits = measureStringUnits(word);

      if (wordUnits > limit) {
        if (currentLine.length > 0) {
          resultLines.push(currentLine);
          currentLine = "";
          currentUnits = 0;
        }
        var subChunks = splitOversizedWord(word, limit);
        for (var c = 0; c < subChunks.length - 1; c++) {
          resultLines.push(subChunks[c]);
        }
        currentLine = subChunks[subChunks.length - 1];
        currentUnits = measureStringUnits(currentLine);
        continue;
      }

      var neededUnits = currentLine.length === 0 ? wordUnits : (currentUnits + spaceUnits + wordUnits);
      if (neededUnits <= limit) {
        if (currentLine.length === 0) {
          currentLine = word;
          currentUnits = wordUnits;
        } else {
          currentLine = currentLine + " " + word;
          currentUnits = neededUnits;
        }
      } else {
        resultLines.push(currentLine);
        currentLine = word;
        currentUnits = wordUnits;
      }
    }

    if (currentLine.length > 0) {
      resultLines.push(currentLine);
    }
  }

  if (resultLines.length === 0) {
    resultLines.push(" ");
  }
  return resultLines;
}

export default {
  FONT_PRESETS: FONT_PRESETS,
  getFontPreset: getFontPreset,
  wrapTextToLines: wrapTextToLines,
  measureStringUnits: measureStringUnits,
  isBlankString: isBlankString
};
