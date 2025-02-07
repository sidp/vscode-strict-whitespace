'use strict';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let showHighlights = true;
	let configuration = vscode.workspace.getConfiguration('strictWhitespace');
	let editorConfig = vscode.workspace.getConfiguration('editor');

	vscode.workspace.onDidChangeConfiguration(() => {
		configuration = vscode.workspace.getConfiguration('strictWhitespace');
		editorConfig = vscode.workspace.getConfiguration('editor');
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

	const spacesDecoratorType = vscode.window.createTextEditorDecorationType({
		before: {
			color: new vscode.ThemeColor('editorWhitespace.foreground'),
			width: '0px',
			contentText: String.fromCharCode(0xb7),
			fontStyle: 'bold',
		},
	});

	const tabsDecoratorType = vscode.window.createTextEditorDecorationType({
		before: {
			color: new vscode.ThemeColor('editorWhitespace.foreground'),
			width: '0px',
			contentText: String.fromCharCode(0x2192),
			fontStyle: 'bold',
		},
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

		const renderWhitespace =
			configuration.get('renderWhitespace') === true &&
			editorConfig.get('renderWhitespace') !== 'all';

		if (renderWhitespace) {
			const spaceCharacters = getSpacesDecorators(decorators);
			activeEditor.setDecorations(spacesDecoratorType, spaceCharacters);

			const tabCharacters = getTabsDecorators(decorators);
			activeEditor.setDecorations(tabsDecoratorType, tabCharacters);
		}
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

	function getDecoratorsForCharacter(
		char: string,
		decorators: vscode.DecorationOptions[],
	): vscode.DecorationOptions[] {
		return decorators.flatMap((decorator) => {
			const decorators: vscode.DecorationOptions[] = [];

			for (
				let i = decorator.range.start.character;
				i < decorator.range.end.character;
				i++
			) {
				if (
					activeEditor?.document.lineAt(decorator.range.start.line).text[i] ===
					char
				) {
					const startPos = new vscode.Position(decorator.range.start.line, i);
					const endPos = new vscode.Position(decorator.range.start.line, i + 1);
					decorators.push({
						range: new vscode.Range(startPos, endPos),
					});
				}
			}

			return decorators;
		});
	}

	function getSpacesDecorators(
		decorators: vscode.DecorationOptions[],
	): vscode.DecorationOptions[] {
		return getDecoratorsForCharacter('\u0020', decorators);
	}

	function getTabsDecorators(
		decorators: vscode.DecorationOptions[],
	): vscode.DecorationOptions[] {
		return getDecoratorsForCharacter('\u0009', decorators);
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
