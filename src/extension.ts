'use strict';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let showHighlights = true;
	let configuration = vscode.workspace.getConfiguration('strictWhitespace');

	vscode.workspace.onDidChangeConfiguration(() => {
		configuration = vscode.workspace.getConfiguration('strictWhitespace');
		triggerUpdateDecorations();
	});

	let toggleInfoMessage: vscode.Disposable;
	vscode.commands.registerCommand('strictWhitespace.toggleHighlights', () => {
		showHighlights = !showHighlights;
		triggerUpdateDecorations();

		if (toggleInfoMessage) {
			toggleInfoMessage.dispose();
		}

		toggleInfoMessage = vscode.window.setStatusBarMessage(
			`${
				showHighlights ? '$(eye) Showing' : '$(eye-closed) Hiding'
			} whitespace highlights`,
			2000,
		);
	});

	const generalDecoratorType: vscode.DecorationRenderOptions = {
		overviewRulerColor: 'rgba(255, 0, 0, 0.4)',
		backgroundColor: 'rgba(255, 0, 0, 0.25)',
		borderRadius: '1px',
		borderColor: 'rgba(255, 0, 0, 0.0)',
		borderStyle: 'solid',
		borderSpacing: '2px',
		borderWidth: '1px',
	};

	const whitespaceDecoratorType = vscode.window.createTextEditorDecorationType({
		...generalDecoratorType,
		overviewRulerLane: vscode.OverviewRulerLane.Right,
	});

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

		const decorators = getWhitespaceDecorators();
		activeEditor.setDecorations(whitespaceDecoratorType, decorators);
	}

	function getWhitespaceDecorators(): vscode.DecorationOptions[] {
		if (!activeEditor || showHighlights === false) {
			return [];
		}

		let decorators: vscode.DecorationOptions[] = [];

		if (configuration.get('disableMixedIndentation') === false) {
			decorators = [...decorators, ...mixedIndentation(activeEditor.document)];
		}

		if (configuration.get('disableTrailingWhitespace') === false) {
			decorators = [
				...decorators,
				...trailingWhitespace(activeEditor.document),
			];
		}

		return decorators.filter(
			(decorator) =>
				activeEditor?.selection.active.compareTo(decorator.range.end) !== 0,
		);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}

/**
 * Returns decorators highlighting unnecessary trailing whitespace.
 *
 * @param document The document to search in.
 * @returns Array of decorators.
 */
export function trailingWhitespace(
	document: vscode.TextDocument,
): vscode.DecorationOptions[] {
	const regEx = /([ \t\f\v]+)$/gm;
	return matchRegex(document, regEx, {
		hoverMessage: 'Unnecessary trailing whitespace',
	});
}

/**
 * Returns decorators highlighting inconsistent whitespace in indentation.
 *
 * @param document The document to search in.
 * @returns Array of decorators.
 */
export function mixedIndentation(
	document: vscode.TextDocument,
): vscode.DecorationOptions[] {
	const regEx = /^(\t* +\t+)/gm;
	return matchRegex(document, regEx, {
		hoverMessage: 'Inconsistent indentation',
	});
}

/**
 * Get decorators from a regular expression
 *
 * @param document The document to search in.
 * @param regEx The regular expression to apply.
 * @param addtionalOptions Any additional DecoratorOptions to insert in the returned decorators.
 * @returns Array of decorators.
 */
function matchRegex(
	document: vscode.TextDocument,
	regEx: RegExp,
	addtionalOptions: Partial<vscode.DecorationOptions>,
): vscode.DecorationOptions[] {
	const text = document.getText();

	const decorators: vscode.DecorationOptions[] = [];
	let match: RegExpExecArray | null;

	while ((match = regEx.exec(text))) {
		const startIndex: number = match.index;
		const endIndex: number = match.index + match[1].length;
		const startPos = document.positionAt(startIndex);
		const endPos = document.positionAt(endIndex);

		if (startIndex < endIndex) {
			decorators.push({
				...addtionalOptions,
				range: new vscode.Range(startPos, endPos),
			});
		}
	}

	return decorators;
}
