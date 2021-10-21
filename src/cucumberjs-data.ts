/* eslint-disable no-inner-declarations */
/* eslint-disable @typescript-eslint/no-namespace */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as rimraf from 'rimraf';

namespace _ {

	function handleResult<T>(resolve: (result: T) => void, reject: (error: Error) => void, error: Error | null | undefined, result: T): void {
		if (error) {
			reject(massageError(error));
		} else {
			resolve(result);
		}
	}

	function massageError(error: Error & { code?: string }): Error {
		if (error.code === 'ENOENT') {
			return vscode.FileSystemError.FileNotFound();
		}

		if (error.code === 'EISDIR') {
			return vscode.FileSystemError.FileIsADirectory();
		}

		if (error.code === 'EEXIST') {
			return vscode.FileSystemError.FileExists();
		}

		if (error.code === 'EPERM' || error.code === 'EACCESS') {
			return vscode.FileSystemError.NoPermissions();
		}

		return error;
	}

	export function checkCancellation(token: vscode.CancellationToken): void {
		if (token.isCancellationRequested) {
			throw new Error('Operation cancelled');
		}
	}

	export function normalizeNFC(items: string): string;
	export function normalizeNFC(items: string[]): string[];
	export function normalizeNFC(items: string | string[]): string | string[] {
		if (process.platform !== 'darwin') {
			return items;
		}

		if (Array.isArray(items)) {
			return items.map(item => item.normalize('NFC'));
		}

		return items.normalize('NFC');
	}

	export function readdir(path: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			fs.readdir(path, (error, children) => handleResult(resolve, reject, error, normalizeNFC(children)));
		});
	}

	export function stat(path: string): Promise<fs.Stats> {
		return new Promise<fs.Stats>((resolve, reject) => {
			fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat));
		});
	}

	export function readfile(path: string): Promise<Buffer> {
		return new Promise<Buffer>((resolve, reject) => {
			fs.readFile(path, (error, buffer) => handleResult(resolve, reject, error, buffer));
		});
	}

	export function writefile(path: string, content: Buffer): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.writeFile(path, content, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function exists(path: string): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			fs.exists(path, exists => handleResult(resolve, reject, null, exists));
		});
	}

	export function rmrf(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			rimraf(path, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function mkdir(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			mkdirp(path, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function rename(oldPath: string, newPath: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.rename(oldPath, newPath, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function unlink(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.unlink(path, error => handleResult(resolve, reject, error, void 0));
		});
	}
}

export enum CucumberType {
    /**
     * A Cucumber Scenario.
     */
    Scenario = 3,
    /**
     * A Cucumber Feature.
     */
    Feature = 4,
    /**
     * A Cucumber Feature.
     */
    StepDef = 5
}

type CucumberJSType = vscode.FileType | CucumberType;
// 树节点
export class EntryItem extends vscode.TreeItem
{
    uri: vscode.Uri = vscode.Uri.file(".");
	type: CucumberJSType = 0;
    constructor(label: string, collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}

export class FileStat implements vscode.FileStat {

	constructor(private fsStat: fs.Stats) { }

	get type(): vscode.FileType {
		return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
	}

	get isFile(): boolean | undefined {
		return this.fsStat.isFile();
	}

	get isDirectory(): boolean | undefined {
		return this.fsStat.isDirectory();
	}

	get isSymbolicLink(): boolean | undefined {
		return this.fsStat.isSymbolicLink();
	}

	get size(): number {
		return this.fsStat.size;
	}

	get ctime(): number {
		return this.fsStat.ctime.getTime();
	}

	get mtime(): number {
		return this.fsStat.mtime.getTime();
	}
}

//Base class
export class CucumberFileProvider implements  vscode.FileSystemProvider {

    protected _onDidChangeEventEmitter: vscode.EventEmitter<vscode.FileChangeEvent[]>;

	constructor() {
		this._onDidChangeEventEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	}

    get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
		return this._onDidChangeEventEmitter.event;
	}

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
		const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async (event: string, filename: string | Buffer) => {
			const filepath = path.join(uri.fsPath, _.normalizeNFC(filename.toString()));

			// TODO support excludes (using minimatch library?)

			this._onDidChangeEventEmitter.fire([{
				type: event === 'change' ? vscode.FileChangeType.Changed : await _.exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
				uri: uri.with({ path: filepath })
			} as vscode.FileChangeEvent]);
		});

		return { dispose: () => watcher.close() };
	}

	stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
		return this._stat(uri.fsPath);
	}

	async _stat(path: string): Promise<vscode.FileStat> {
		return new FileStat(await _.stat(path));
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
		return this._readDirectory(uri);
	}

	async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		const children = await _.readdir(uri.fsPath);

		const result: [string, vscode.FileType][] = [];
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
            if(child.startsWith(".")) continue;
			const stat = await this._stat(path.join(uri.fsPath, child));
			result.push([child, stat.type]);
		}

		return Promise.resolve(result);
	}


	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		return _.mkdir(uri.fsPath);
	}

	readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
		return _.readfile(uri.fsPath);
	}

	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
		return this._writeFile(uri, content, options);
	}

	async _writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
		const exists = await _.exists(uri.fsPath);
		if (!exists) {
			if (!options.create) {
				throw vscode.FileSystemError.FileNotFound();
			}

			await _.mkdir(path.dirname(uri.fsPath));
		} else {
			if (!options.overwrite) {
				throw vscode.FileSystemError.FileExists();
			}
		}

		return _.writefile(uri.fsPath, content as Buffer);
	}

	delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
		if (options.recursive) {
			return _.rmrf(uri.fsPath);
		}

		return _.unlink(uri.fsPath);
	}

	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
		return this._rename(oldUri, newUri, options);
	}

	async _rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Promise<void> {
		const exists = await _.exists(newUri.fsPath);
		if (exists) {
			if (!options.overwrite) {
				throw vscode.FileSystemError.FileExists();
			} else {
				await _.rmrf(newUri.fsPath);
			}
		}

		const parentExists = await _.exists(path.dirname(newUri.fsPath));
		if (!parentExists) {
			await _.mkdir(path.dirname(newUri.fsPath));
		}

		return _.rename(oldUri.fsPath, newUri.fsPath);
	}
}


//Features 
export class CucumberFeatureDataProvider extends CucumberFileProvider implements vscode.TreeDataProvider<EntryItem>
{
    parseCucumberFeatureFile(uri: vscode.Uri): [string, CucumberJSType][] | Thenable<[string, CucumberJSType][]> {
		return this._parseCucumberFeatureFile(uri);
	}

    async _parseCucumberFeatureFile(uri: vscode.Uri): Promise<[string, CucumberJSType][]>  {
        const fileContent = await this.readFile(uri);

        console.log(fileContent.toLocaleString());

        const reFeatures = /^Feature:(.+)/gim;

        console.log(fileContent.toString().match(reFeatures));
        console.log(reFeatures.exec(fileContent.toString()));
        const features = fileContent.toString().match(reFeatures)!;
		const result: [string, CucumberType][] = [];
        for(let i = 0; i < features.length; i++) {
            const feature = features[i];
            result.push([feature, CucumberType.Feature]);
        }

        return Promise.resolve(result);
    }

    parseCucumberScenario(uri: vscode.Uri,featureName: string) {
		return this._parseCucumberScenario(uri, featureName);
    }

    async _parseCucumberScenario(uri: vscode.Uri,featureName: string): Promise<[string, CucumberJSType][]>  {
        const fileContent = await this.readFile(uri);

        //Do NOT handle multiple feature in one file
		// const strFileContent = fileContent.toString();
        // const strReFeature = `${featureName}([\\d\\D]+?)`;
		// const reFeature = new RegExp(strReFeature);
        // const featureContent = strFileContent.match(reFeature)[0];
        // console.log(featureContent.toLocaleString());

        const reScenario = /^\s+Scenario:(.+)/gim;
        console.log(fileContent.toString().match(reScenario));
        const scenarios = fileContent.toString().match(reScenario)!;
		const result: [string, CucumberType][] = [];
        for(let i = 0; i < scenarios.length; i++) {
            const scenario = scenarios[i];
            result.push([scenario, CucumberType.Scenario]);
        }

        return Promise.resolve(result);
    }

    async jumpToFile(uri: vscode.Uri) {
		const pathArray = uri.fsPath.toString().split("/");
		const scenarioName = pathArray[pathArray.length - 1];
		const featureName = pathArray[pathArray.length - 2];
		const filePath = uri.fsPath.toString().replace(`/${scenarioName}`, "").replace(`/${featureName}`, "");
		const fileContent = await this.readFile(vscode.Uri.file(filePath));
		const fileContentArray = fileContent.toString().split("\n");
		for (let i = 0;i < fileContentArray.length; i++){
			if(fileContentArray[i].includes(scenarioName)){
				vscode.window.showTextDocument(vscode.Uri.file(filePath));
				const editor = vscode.window.activeTextEditor!;
				const range = editor.document.lineAt(i).range;
				editor.selection =  new vscode.Selection(range.start, range.end);
				editor.revealRange(range);
				return;
			}
		}
	}
    
    onDidChangeTreeData?: vscode.Event<void | EntryItem | null | undefined> | undefined;
    getTreeItem(element: EntryItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		const treeItem = new vscode.TreeItem(element.uri, element.type === CucumberType.Scenario ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);

        if (element.type === vscode.FileType.File) {
			treeItem.command = { command: 'extension.openFile', title: "Open File", arguments: [element.uri] };
			treeItem.contextValue = 'file';
		}
        if (element.type === CucumberType.Scenario) {
			treeItem.command = { command: 'extension.openScenario', title: "Open Scenario", arguments: [element.uri] };
			treeItem.contextValue = 'scenario';
		}
        if (element.type === CucumberType.Feature) {
			treeItem.command = { command: 'extension.openFeature', title: "Open Feature", arguments: [element.uri] };
			treeItem.contextValue = 'feature';
		}
		return treeItem;
    }

    async getChildren(element?: EntryItem): Promise<EntryItem[]> {
		if (element) {
            if (element.type === vscode.FileType.File) {
                // const fileContent = await this.parseCucumberFeatureFile(element.uri);
                // console.log(fileContent);
                const children = await this.parseCucumberFeatureFile(element.uri);
                return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
            }
            if (element.type === CucumberType.Feature) {
                // const fileContent = await this.parseCucumberFeatureFile(element.uri);
                // console.log(fileContent);
				const pathArray = element.uri.fsPath.toString().split("/");
				const featureName = pathArray[pathArray.length-1];
				const filePath = element.uri.fsPath.toString().replace(`/${featureName}`, "");
                const children = await this.parseCucumberScenario(vscode.Uri.file(filePath), featureName);
                return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
            }
                
            const children = await this.readDirectory(element.uri);
            return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
		}

		const workspaceFolder = vscode.workspace.workspaceFolders!.filter(folder => folder.uri.scheme === 'file')[0];
		if (workspaceFolder) {
            const featuresUri = vscode.Uri.file(workspaceFolder.uri.fsPath+"/features/testcase");
			const children = await this.readDirectory(featuresUri);
			children.sort((a, b) => {
				if (a[1] === b[1]) {
					return a[0].localeCompare(b[0]);
				}
				return a[1] === vscode.FileType.Directory ? -1 : 1;
			});
			return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath+"/features/testcase", name)), type }));
		}

		return [];
    }
}

//StepDefinition
export class CucumberStepDefDataProvider extends CucumberFileProvider implements vscode.TreeDataProvider<EntryItem>
{
    parseCucumberStepDefFile(uri: vscode.Uri): [string, CucumberJSType][] | Thenable<[string, CucumberJSType][]> {
		return this._parseCucumberStepDefFile(uri);
	}

    async _parseCucumberStepDefFile(uri: vscode.Uri): Promise<[string, CucumberJSType][]>  {
        const fileContent = await this.readFile(uri);

        console.log(fileContent.toLocaleString());

        const reWhen = /^(When|Then|Given)(.+)/gim;

        console.log(fileContent.toString().match(reWhen));
        const features = fileContent.toString().match(reWhen)!;
		const result: [string, CucumberType][] = [];
        for(let i = 0; i < features.length; i++) {
            const feature = features[i];
            result.push([feature, CucumberType.StepDef]);
        }

        return Promise.resolve(result);
    }

    async jumpToFile(uri: vscode.Uri) {
		const pathArray = uri.fsPath.toString().split("/");
		const stepName = pathArray[pathArray.length - 1];
		const filePath = uri.fsPath.toString().replace(`/${stepName}`, "");
		const fileContent = await this.readFile(vscode.Uri.file(filePath));
		const fileContentArray = fileContent.toString().split("\n");
		for (let i = 0;i < fileContentArray.length; i++){
			if(fileContentArray[i].includes(stepName)){
				vscode.window.showTextDocument(vscode.Uri.file(filePath));
				const editor = vscode.window.activeTextEditor!;
				const range = editor.document.lineAt(i).range;
				editor.selection =  new vscode.Selection(range.start, range.end);
				editor.revealRange(range);
				return;
			}
		}
	}

    onDidChangeTreeData?: vscode.Event<void | EntryItem | null | undefined> | undefined;
    getTreeItem(element: EntryItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		const treeItem = new vscode.TreeItem(element.uri, element.type === CucumberType.StepDef ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);

        if (element.type === vscode.FileType.File) {
			treeItem.command = { command: 'extension.openFile', title: "Open File", arguments: [element.uri] };
			treeItem.contextValue = 'file';
		}
        if (element.type === CucumberType.StepDef) {
			treeItem.command = { command: 'extension.openStepDef', title: "Open StepDef", arguments: [element.uri] };
			treeItem.contextValue = 'stepdef';
		}
		return treeItem;
    }

    async getChildren(element?: EntryItem): Promise<EntryItem[]> {
		if (element) {
            if (element.type === vscode.FileType.File) {
                // const fileContent = await this.parseCucumberFeatureFile(element.uri);
                // console.log(fileContent);
                const children = await this.parseCucumberStepDefFile(element.uri);
                return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
            }   
            const children = await this.readDirectory(element.uri);
            return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
		}
		const valueFilter = vscode.workspace.workspaceFolders!.filter(folder => folder.uri.scheme === 'file');
		const workspaceFolder = valueFilter[0];
		if (workspaceFolder) {
            const featuresUri = vscode.Uri.file(workspaceFolder.uri.fsPath+"/features/step_definitions");
			const children = await this.readDirectory(featuresUri);
			children.sort((a, b) => {
				if (a[1] === b[1]) {
					return a[0].localeCompare(b[0]);
				}
				return a[1] === vscode.FileType.Directory ? -1 : 1;
			});
			return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath+"/features/step_definitions", name)), type }));
		}

		return [];
    }

}