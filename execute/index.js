#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { TryDownloadingUrls } from './install.js';

// Repo for Bin download.
const REPONAME = "xtatix-central";
const REPOLINK = "https://github.com/xtatixone/" + REPONAME

const platformBinMap = {
    'win32-386': 'windows-386.exe',
    'win32-amd64': 'windows-amd64.exe',
    'win32-arm64': 'windows-arm64.exe',
    'linux-amd64': 'linux-amd64',
    'linux-arm64': 'linux-arm64',
    'linux-armv7': 'linux-armv7',
    'darwin-amd64': 'darwin-amd64',
    'darwin-arm64': 'darwin-arm64',
};

function normalizeArch(arch) {
    if (arch === 'x64') return 'amd64';
    if (arch === 'ia32') return '386';
    return arch;
}
const __system = `${process.platform}-${normalizeArch(process.arch)}`;

const __filename = fileURLToPath(import.meta.url);
const __binfile = platformBinMap[__system];
const __package = path.resolve(__filename, '..', '..');
const __compiler = path.resolve(__package, 'compiler');
const __scaffold = path.resolve(__package, 'scaffold');
const __bindir = path.resolve(__compiler, 'bin');
if (!__binfile) { console.error(`Unsupported platform or architecture: ${__system}`); process.exit(1); }

const packageJsonPath = path.join(__package, 'package.json');
const scaffoldJsonPath = path.join(__scaffold, 'package.json');
const compilerConfigPath = path.join(__package, 'compiler', 'bin', 'configs.json');

const packageData = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) : {};
const scaffoldData = fs.existsSync(scaffoldJsonPath) ? JSON.parse(fs.readFileSync(scaffoldJsonPath, 'utf8')) : {};
const compilerData = fs.existsSync(compilerConfigPath) ? JSON.parse(fs.readFileSync(compilerConfigPath, 'utf8')) : {};

const UpdatePackageJson = () => fs.writeFileSync(packageJsonPath, JSON.stringify(packageData, " ", "  "))
const UpdateScaffoldJson = () => fs.writeFileSync(scaffoldJsonPath, JSON.stringify(scaffoldData, " ", "  "))
const UpdateCompilerConfig = () => fs.writeFileSync(compilerConfigPath, JSON.stringify(compilerData, " ", "  "))

let version = "";
if (packageData.name === REPONAME) {
    version = packageData["version"]
    packageData["compilerVersion"] = version
    UpdatePackageJson();

    scaffoldData.version = version;
    scaffoldData.configs.version = version;
    UpdateScaffoldJson();
} else { version = packageData["compilerVersion"] }


const patchTag = version;
const minorTag = version.split(".").slice(0, 2).join(".");
const majorTag = version.split(".")[0];

const patchTagUrl = `${REPOLINK}/releases/download/v${patchTag}/${__binfile}`;
const minorTagUrl = `${REPOLINK}/releases/download/v${minorTag}/${__binfile}`;
const majorTagUrl = `${REPOLINK}/releases/download/v${majorTag}/${__binfile}`;
const latestTagUrl = `${REPOLINK}/releases/download/latest/${__binfile}`;
const DownloadUrls = [patchTagUrl, minorTagUrl, majorTagUrl, latestTagUrl]

const devMode = fs.existsSync(path.resolve(__compiler, "scripts"));
const devPath = path.resolve(__compiler, "scripts", "live.sh");
const binpath = path.resolve(__bindir, __binfile);

fs.writeFileSync(path.join(__package, "BINPATH"), binpath)
function syncMarkdown() {
    let readme = fs.readFileSync(path.resolve(__package, "execute", "intro.md")).toString().trim();
    readme += "\n\n---\n\n" + fs.readFileSync(path.resolve(__compiler, "README.md")).toString().trim();
    readme += "\n\n---\n\n" + fs.readFileSync(path.resolve(__scaffold, "README.md")).toString().trim();
    fs.writeFileSync(path.resolve(__package, "README.md"), readme)
}

function ReadFlavourConfigs(flavourdir) {
    const resolved = {
        "name": "",
        "version": "",
        "sandbox": "",
        "blueprint": "",
        "libraries": ""
    };
    try {
        const flavourPackagePath = path.join(flavourdir, 'package.json');
        const configs = { ...resolved };
        if (fs.existsSync(flavourPackagePath)) {
            const data = fs.readFileSync(flavourPackagePath, 'utf8');
            try {
                const flavourData = JSON.parse(data);
                Object.assign(configs, (flavourData.configs || {}))
            } catch { }
        }

        Object.keys(resolved).forEach((k) => {
            if (typeof resolved[k] === typeof configs[k]) {
                switch (k) {
                    case "sandbox":
                    case "blueprint":
                    case "libraries":
                        resolved[k] = path.resolve(flavourdir, configs[k])
                        break;
                    default:
                        resolved[k] = configs[k];
                }
            }
        })
    }
    finally {
        return resolved;
    }
}

compilerData["name"] = packageData["name"];
compilerData["version"] = packageData["version"];
const defaultFlavour = ReadFlavourConfigs(__scaffold);
if (typeof compilerData["flavour"] == "object") {
    compilerData["flavour"]["default"] = defaultFlavour;
} else {
    compilerData["flavour"] = { "default": defaultFlavour }
}
if (typeof compilerData["flavour"]["workspace"] !== "object") {
    compilerData["flavour"]["workspace"] = {}
}
UpdateCompilerConfig();


export async function RunCommand(args = []) {
    args = args.length ? args : process.argv.slice(2);

    if (args[0] === "binpath") {
        console.log(binpath)
    } else {
        try {
            if (args[0] === "init" && args[1]) {
                compilerData["flavour"]["workspace"][process.env.PWD] = ReadFlavourConfigs(path.join(__package, "..", args[1]));
                UpdateCompilerConfig();
            }

            await TryDownloadingUrls(binpath, DownloadUrls);
            if (!fs.existsSync(binpath)) {
                console.error('Binary file not found after download.');
                process.exit(1);
            }

            const child = spawnSync(binpath, args, { stdio: 'inherit' });

            if (child.error) { console.error(`Failed to execute ${__binfile} at ${binpath}: ${child.error.message}`); }
            else { syncMarkdown() }
        } catch (err) {
            console.error(`Error: ${err.message}`);
        }
    }
}
RunCommand();

export function GetMetadata() {
    return {
        DevMode: devMode,
        binPath: devMode ? devPath : binpath,
        PackageName: packageData.name
    };
}