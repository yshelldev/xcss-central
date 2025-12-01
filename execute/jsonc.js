import fs from 'fs';

export class JSONC {
    static removeComments(jsonc) {
        let isInString = false;
        let isInSingleLineComment = false;
        let isInMultiLineComment = false;
        let result = '';
        let prevChar = '';
        for (let i = 0; i < jsonc.length; i++) {
            const char = jsonc[i];
            const nextChar = jsonc[i + 1];

            if (isInSingleLineComment) {
                if (char === '\n') {
                    isInSingleLineComment = false;
                    result += char;
                }
                continue;
            }
            else if (isInMultiLineComment) {
                if (prevChar === '*' && char === '/') {
                    isInMultiLineComment = false;
                }
                prevChar = char;
                continue;
            }
            else if (char === '"' && prevChar !== '\\') {
                isInString = !isInString;
                result += char;
            }
            else if (!isInString && char === '/' && nextChar === '/') {
                isInSingleLineComment = true;
                i++; // skip nextChar
            }
            else if (!isInString && char === '/' && nextChar === '*') {
                isInMultiLineComment = true;
                i++; // skip nextChar
            }
            else {
                result += char;
            }
            prevChar = char;
        }

        if (isInString) throw new Error("Unterminated string literal in JSONC");
        if (isInMultiLineComment) throw new Error("Unterminated multi-line comment in JSONC");

        return result;
    }

    static Parse(filepath) {
        try {
            const content = fs.readFileSync(filepath, 'utf-8');
            const cleaned = this.removeComments(content);
            return JSON.parse(cleaned);
        } catch {
            return {};
        }
    }
}
