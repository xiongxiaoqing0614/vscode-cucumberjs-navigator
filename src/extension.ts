// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cucumberjs from "./cucumberjs-data";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	//register features view
	const cucumberFeatureData = new cucumberjs.CucumberFeatureDataProvider();
	vscode.window.registerTreeDataProvider("cucumberjs_features",cucumberFeatureData);

	vscode.commands.registerCommand("cucumberjs_features.openChild",args => {
		vscode.window.showInformationMessage(args);
	});

	vscode.commands.registerCommand('extension.openScenario', uri => cucumberFeatureData.jumpToScenario(uri));
	vscode.commands.registerCommand('extension.openFeature', uri => cucumberFeatureData.jumpToFeature(uri));
	vscode.commands.registerCommand('extension.openFeatureFile', uri => cucumberFeatureData.jumpToFile(uri));
	vscode.commands.registerCommand('cucumberjs_features.refresh', () => cucumberFeatureData.refresh());


	//register steps view
	const cucumberStepDefData = new cucumberjs.CucumberStepDefDataProvider();
	vscode.window.registerTreeDataProvider("cucumberjs_steps",cucumberStepDefData);

	vscode.commands.registerCommand('extension.openStepFile', uri => cucumberStepDefData.jumpToFile(uri));
	vscode.commands.registerCommand('extension.openStepDef', uri => cucumberStepDefData.jumpToStepDef(uri));
	vscode.commands.registerCommand('cucumberjs_steps.refresh', () => cucumberStepDefData.refresh());

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-cucumberjs-navigator" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('vscode-cucumberjs-navigator.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from vscode-cucumberjs-navigator!');
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
