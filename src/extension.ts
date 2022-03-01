'use strict';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const generalDecoratorType: vscode.DecorationRenderOptions = {
		overviewRulerColor: 'rgba(255, 0, 0, 0.4)',
		backgroundColor: 'rgba(255, 0, 0, 0.25)',
		borderRadius: '1px',
		borderColor: 'rgba(255, 0, 0, 0.0)',
		borderStyle: 'solid',
		borderSpacing: '2px',
		borderWidth: '1px',
	};

	const trailingWhitespaceDecoratorType =
		vscode.window.createTextEditorDecorationType(
			Object.assign({}, generalDecoratorType, {
				overviewRulerLane: vscode.OverviewRulerLane.Right,
			}),
		);

	let activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(
		(editor) => {
			activeEditor = editor;
			if (editor) {
				triggerUpdateDecorations();
			}
		},
		null,
		context.subscriptions,
	);

	vscode.workspace.onDidChangeTextDocument(
		(event) => {
			if (activeEditor && event.document === activeEditor.document) {
				triggerUpdateDecorations();
			}
		},
		null,
		context.subscriptions,
	);

	var timeout: NodeJS.Timeout | undefined;
	function triggerUpdateDecorations() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		timeout = setTimeout(updateDecorations, 250);
	}

	function updateDecorations() {
		if (!activeEditor) {
			return;
		}

		const trailingWhitespace = updateTrailingWhitespace();

		activeEditor.setDecorations(
			trailingWhitespaceDecoratorType,
			trailingWhitespace,
		);
	}

	function updateTrailingWhitespace() {
		const extraWhitespace: vscode.DecorationOptions[] = [];

		if (!activeEditor) {
			return extraWhitespace;
		}

		const regEx = /([ \t\f\v]+)$/gm;
		const text = activeEditor.document.getText();

		let match: RegExpExecArray | null;
		while ((match = regEx.exec(text))) {
			const startIndex: number = match.index;
			const endIndex: number = match.index + match[1].length;
			const startPos = activeEditor.document.positionAt(startIndex);
			const endPos = activeEditor.document.positionAt(endIndex);
			const cursorFromEnd = activeEditor.selection.active.compareTo(endPos);

			if (startIndex < endIndex && cursorFromEnd !== 0) {
				const decoration = {
					range: new vscode.Range(startPos, endPos),
					hoverMessage: 'Unnecessary whitespace',
				};
				extraWhitespace.push(decoration);
			}
		}

		return extraWhitespace;
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
