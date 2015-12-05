import * as _ from "lodash";
import * as vscode from "vscode";
import TextEditor from "./../textEditor";

abstract class Motion<T extends Motion<any>> {
	private static nonWordCharacters = "/\\()\"':,.;<>~!@#$%^&*|+=[]{}`?-";
	private prevColumn: number = 0;

	public static getActualPosition(): vscode.Position {
		return vscode.window.activeTextEditor.selection.active;
	}

	public position : vscode.Position;

	public constructor(line : number = null, character : number = null) {
		if (line === null || character == null) {
			let currentPosition = Motion.getActualPosition();

			line = currentPosition.line;
			character = currentPosition.character;
		}

		this.prevColumn = character;
		this.position = new vscode.Position(line, character);
	}

	protected abstract maxLineLength(line: number) : number;

	public reset() : T {
		this.position = Motion.getActualPosition();
		return <any>this;
	}

	public move() : T {
		let selection = new vscode.Selection(this.position, this.position);
		vscode.window.activeTextEditor.selection = selection;

		let range = new vscode.Range(this.position, this.position);
		vscode.window.activeTextEditor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

		return <any>this;
	}

	public left() : T {
		if (!this.isLineBeginning(this.position)) {
			this.position = this.position.translate(0, -1);
			this.prevColumn = this.position.character;
		}

		return <any>this;
	}

	public right() : T {
		if (!this.isLineEnd(this.position)) {
			this.position = this.position.translate(0, 1);
			this.prevColumn = this.position.character;
		}

		return <any>this;
	}

	public down() : T {
		if (!TextEditor.isLastLine(this.position)) {
			let newLine = this.position.line + 1;

			let lineLength = TextEditor.readLine(newLine).length;
			let newCharMax = lineLength > 0 ? lineLength - 1 : 0;
			let newChar = Math.min(newCharMax, this.prevColumn);

			this.position = new vscode.Position(newLine, newChar);
		}

		return <any>this;
	}

	public up() : T {
		if (!TextEditor.isFirstLine(this.position)) {
			let newLine = this.position.line - 1;

			let lineLength = TextEditor.readLine(newLine).length;
			let newCharMax = lineLength > 0 ? lineLength - 1 : 0;
			let newChar = Math.min(newCharMax, this.prevColumn);

			this.position = new vscode.Position(newLine, newChar);
		}

		return <any>this;
	}

	public wordLeft(): T {
		let currentLine = TextEditor.getLineAt(this.position);
		if (this.position.character <= currentLine.firstNonWhitespaceCharacterIndex && this.position.line !== 0) {
			let line = TextEditor.getLineAt(this.position.translate(-1));
			this.position = new vscode.Position(line.lineNumber, line.range.end.character);
			return <any>this;
		}

		let nextPos = Motion.getPreviousWordPosition(this.position);
		this.position = new vscode.Position(nextPos.line, nextPos.character);

		return <any>this;
	}

	public wordRight() : T {
		if (this.position.character === this.getLineEnd().character) {
			if (!TextEditor.isLastLine(this.position)) {
				let line = TextEditor.getLineAt(this.position.translate(1));

				this.position = new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex);
			}
		} else {
			let nextPos = Motion.getNextWordPosition(this.position);
			if (nextPos === null) {
				return this.lineEnd();
			}

			this.position = new vscode.Position(nextPos.line, nextPos.character);
		}

		return <any>this;
	}

	public lineBegin() : T {
		this.position = new vscode.Position(this.position.line, 0);
		return <any>this;
	}

	public lineEnd() : T {
		this.position = this.getLineEnd();
		return <any>this;
	}

	public firstLineNonBlankChar() : T {
		this.position = new vscode.Position(0, Motion.getFirstNonBlankCharAtLine(0));
		return <any>this;
	}

	public lastLineNonBlankChar() : T {
		let line = vscode.window.activeTextEditor.document.lineCount - 1;
		let character = Motion.getFirstNonBlankCharAtLine(line);

		this.position = new vscode.Position(line, character);
		return <any>this;
	}

	public documentBegin() : T {
		this.position = new vscode.Position(0, 0);
		return <any>this;
	}

	public documentEnd() : T {
		let lineCount = TextEditor.getLineCount();
		let line = lineCount > 0 ? lineCount - 1 : 0;
		this.position = new vscode.Position(line, TextEditor.readLine(line).length);
		return <any>this;
	}

	private isLineBeginning(position : vscode.Position) : boolean {
		return position.character === 0;
	}

	public isLineEnd(position : vscode.Position) : boolean {
		let lineEnd  = this.maxLineLength(position.line);
		if (this.isOutOfRange(position)) {
			throw new RangeError;
		}

		return position.character === lineEnd;
	}
	
	public isOutOfRange(position : vscode.Position) : boolean {
		let lineEnd  = this.maxLineLength(position.line);
		if (lineEnd < 0) {
			lineEnd = 0;
		}

		if (position.character > lineEnd) {
			return true;
		}

		return false;
	}

	private getLineEnd() : vscode.Position {
		return new vscode.Position(this.position.line, this.maxLineLength(this.position.line));
	}

	private static getNextWordPosition(position : vscode.Position): vscode.Position {
		let segments = ["(^[\t ]*$)"];
		segments.push(`([^\\s${_.escapeRegExp(Motion.nonWordCharacters) }]+)`);
		segments.push(`[\\s${_.escapeRegExp(Motion.nonWordCharacters) }]+`);

		let reg = new RegExp(segments.join("|"), "g");
		let line = TextEditor.getLineAt(position);
		let words = line.text.match(reg);

		let startWord: number;
		let endWord: number;

		if (words) {
			for (var index = 0; index < words.length; index++) {
				var word = words[index].trim();
				if (word.length > 0) {
					startWord = line.text.indexOf(word, endWord);
					endWord = startWord + word.length;

					if (position.character < startWord) {
						return new vscode.Position(position.line, startWord);
					}
				}
			}
		}

		return null;
	}

	private static getPreviousWordPosition(position : vscode.Position): vscode.Position {
		let segments = ["(^[\t ]*$)"];
		segments.push(`([^\\s${_.escapeRegExp(Motion.nonWordCharacters) }]+)`);
		segments.push(`[\\s${_.escapeRegExp(Motion.nonWordCharacters) }]+`);
		let reg = new RegExp(segments.join("|"), "g");

		let line = TextEditor.getLineAt(position);
		let words = line.text.match(reg);

		let startWord: number;
		let endWord: number;

		if (words) {
			words = words.reverse();
			endWord = line.range.end.character;
			for (var index = 0; index < words.length; index++) {
				endWord = endWord - words[index].length;
				var word = words[index].trim();
				if (word.length > 0) {
					startWord = line.text.indexOf(word, endWord);

					if (startWord !== -1 && position.character > startWord) {
						return new vscode.Position(position.line, startWord);
					}
				}
			}
		}

		return null;
	}

	private static getFirstNonBlankCharAtLine(line: number): number {
		return TextEditor.readLine(line).match(/^\s*/)[0].length;
	}
}

export class Caret extends Motion<Caret> {
	// Valid Positions for Caret: [0, eol)
	protected maxLineLength(line: number) : number {
		var len = TextEditor.readLine(line).length;
		return len > 0 ? len - 1 : len;
	}

}

export class Cursor extends Motion<Cursor> {
	// Valid Positions for Cursor: [0, eol]
	protected maxLineLength(line: number) : number {
		return TextEditor.readLine(line).length;
	}

}
