import * as vscode from 'vscode';
import {ModeName, Mode} from './mode';
import TextEditor from './../textEditor';
import {Cursor} from './../motion/motion';

export default class InsertMode extends Mode {
    private cursor : Cursor;
    private activationKeyHandler : { [ key : string] : (cursor : Cursor) => Thenable<{}> } = {
        "i" : () => {
            // insert at cursor
            return Promise.resolve({});
        },
        "I" : c => {
            // insert at line beginning
            return Promise.resolve(c.lineBegin().move());
        },
        "a" : c => {
            // append after the cursor
            return Promise.resolve(c.right().move());
        },
        "A" : c => {
            // append at the end of the line
	       return Promise.resolve(c.lineEnd().move());
        },
        "o" : () => {
            // open blank line below current line
	       return vscode.commands.executeCommand("editor.action.insertLineAfter");
        },
        "O" : () => {
            // open blank line above current line
	       return vscode.commands.executeCommand("editor.action.insertLineBefore");
        }
    };

    constructor() {
        super(ModeName.Insert);
        this.cursor = new Cursor();
    }

    ShouldBeActivated(key : string, currentMode : ModeName) : boolean {
        return key in this.activationKeyHandler;
    }

    HandleActivation(key : string) : Thenable<{}> {
        this.cursor.reset();
        return this.activationKeyHandler[key](this.cursor);
    }

    HandleKeyEvent(key : string) : Thenable<{}> {
        this.keyHistory.push(key);

        TextEditor.insert(this.ResolveKeyValue(key))
            .then(() => {
				let reg = new RegExp("[a-zA-Z]");
				if (reg.test(key)) {
					let cursor = new Cursor();
					let pos = cursor.reset().position;
					let text = TextEditor.readLine(pos.line);
					if (text.length > 0) {
					   let c = text[pos.character - 1];
					   if (c !== undefined && reg.test(c)) {
						   vscode.commands.executeCommand("editor.action.triggerSuggest");
						   return true;
					   }
					}
				}
				vscode.commands.executeCommand("hideSuggestWidget");
				return true;
			}, function() {
				vscode.commands.executeCommand("hideSuggestWidget");
				return false;
			});

        return;
    }

    // Some keys have names that are different to their value.
    // TODO: we probably need to put this somewhere else.
    private ResolveKeyValue(key : string) : string {
        switch (key) {
            case 'space':
                return ' ';
            case 'backspace':
                vscode.commands.executeCommand("deleteLeft");
                return '';
            default:
                return key;
        }
    }
}
