import {
  FileSystemAdapter,
  FileView,
  MarkdownView,
  Plugin,
  TAbstractFile,
  TFile,
  TFolder,
} from "obsidian";
import * as http from "http";
import * as fs from "fs";
import * as url from "url";
import open from "open";

export default class ObsidianPrint extends Plugin {
  host: string = "127.0.0.1";
  port: number = 8124;

  server: http.Server;

  async writeMarkdownPreviewResponse(response: http.ServerResponse) {
    const activeLeaf = this.app.workspace.activeLeaf;
    const view = activeLeaf.view as MarkdownView;
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const basePath = adapter.getBasePath();
    const cssPath = basePath + "/obsidian.css";
    let body = view.previewMode.containerEl.innerHTML;

    const pathReplacements = [
      `app://local/${encodeURIComponent(adapter.getBasePath())}%2F`,
    ];
    for (const replacement of pathReplacements) {
      body = body.replace(replacement, "");
    }

    response.writeHead(200, "OK", { "Content-type": "text/html" });
    response.write("<!DOCTYPE html><html><head><meta charset='utf-8' />");
    if (fs.existsSync(cssPath)) {
      response.write("<style type='text/css'>");
      response.write(fs.readFileSync(cssPath));
      response.write("</style>");
    }
    response.write("</head><body>");
    response.write(body);
    response.write("</body></html>");
    response.end();
    return;
  }

  async writeRawFileResponse(
    matchingFile: TFile,
    response: http.ServerResponse
  ) {
    const data = await this.app.vault.readBinary(matchingFile);

    response.writeHead(200, "OK", {
      "Content-Type": "application/octet-stream",
    });
    response.write(Buffer.from(data));
    response.end();
  }

  async writeRedirectResponse(response: http.ServerResponse) {
    response.writeHead(302, "Found", {
      Location: `/${
        (this.app.workspace.activeLeaf.view as FileView).file.path
      }`,
    });
    response.end();
  }

  async loadNewDocument(file: TFile) {
    if (
      (this.app.workspace.activeLeaf.view as FileView).file.path !== file.path
    ) {
      console.log("Loading new document");
      await this.app.workspace.activeLeaf.openFile(file);
    }
  }

  isTFile(file: TAbstractFile): file is TFile {
    return (file as TFolder).children === undefined;
  }

  isTFolder(file: TAbstractFile): file is TFolder {
    return (file as TFolder).children !== undefined;
  }

  getMatchingFileObject(folder: TFolder, filename: string): TFile | null {
    for (const child of folder.children) {
      if (this.isTFile(child)) {
        if (child.path === filename || child.path === filename + ".md") {
          return child;
        }
      } else if (this.isTFolder(child)) {
        const result = this.getMatchingFileObject(child, filename);
        if (result) {
          return result;
        }
      }
    }
  }

  async requestListener(
    request: http.IncomingMessage,
    response: http.ServerResponse
  ) {
    const parsedUrl = new url.URL(`http://127.0.0.1${request.url}`);
    const location = decodeURI(parsedUrl.pathname).slice(1);
    const root = this.app.vault.getRoot();
    const matchingFile = this.getMatchingFileObject(root, location);

    if (!location) {
      this.writeRedirectResponse(response);
    } else if (matchingFile && matchingFile.extension === "md") {
      await this.loadNewDocument(matchingFile);
      this.writeMarkdownPreviewResponse(response);
    } else if (matchingFile && matchingFile.extension !== "md") {
      this.writeRawFileResponse(matchingFile, response);
    } else {
      response.writeHead(404, "Not Found");
      response.write("Not found");
      response.end();
      return;
    }
  }

  async onload() {
    this.server = http.createServer(this.requestListener.bind(this));
    this.server.listen(this.port, this.host);

    this.addCommand({
      id: "open-preview-in-browser",
      name: "Open preview in browser",
      callback: async () => {
        const activeLeaf = this.app.workspace.activeLeaf;
        const activeView = activeLeaf.view as FileView;
        const filename = activeView.file.path;

        open(`http://127.0.0.1:${this.port}/${filename}`);
      },
    });
    this.addCommand({
      id: "open-preview-debug",
      name: "Debug",
      callback: async () => {
        console.log(this);
      },
    });
  }

  async onunload() {
    this.server.close();
  }
}
