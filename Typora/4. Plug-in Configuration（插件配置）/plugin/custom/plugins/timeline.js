class timelinePlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    process = () => {
        this.utils.diagramParser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "markdown",
            destroyWhenUpdate: false,
            renderFunc: this.render,
            cancelFunc: null,
            destroyAllFunc: null,
            extraStyleGetter: this.getStyleContent,
            interactiveMode: this.config.INTERACTIVE_MODE
        });
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    getStyleContent = () => this.utils.styleTemplater.getStyleContent(this.fixedName)

    render = (cid, content, $pre) => {
        let timeline = $pre.find(".plugin-timeline");
        if (timeline.length === 0) {
            timeline = $(`<div class="plugin-timeline"><div class="timeline-title"></div><div class="timeline-content"></div></div>`);
        }
        const timeline_ = this.newTimelineElement($pre, cid, content);
        if (timeline_) {
            timeline.find(".timeline-title").text(timeline_.title);
            timeline.find(".timeline-content").html(timeline_.bucket);
            $pre.find(".md-diagram-panel-preview").html(timeline);
        } else {
            // accident occurred
            this.utils.diagramParser.throwParseError(null, this.i18n._t("global", "error.unknown"))
        }
    }

    newTimelineElement = (pre, cid, content) => {
        // timeline: {title, bucket: [{time, itemList: [{ type, value }]}]}
        const timeline = { title: "", bucket: [] };
        const lines = content.split("\n");
        const dir = this.utils.getCurrentDirPath();
        const { throwParseError } = this.utils.diagramParser;
        lines.forEach((line, idx) => {
            if (!line.trim()) return;
            idx += 1;

            if (line.startsWith("# ")) {
                if (!timeline.title) {
                    if (timeline.bucket.length !== 0) {
                        throwParseError(idx, this.i18n.t("error.bodyComeBeforeTitle"))
                    }
                } else {
                    throwParseError(idx, this.i18n.t("error.multiTitles"))
                }
                timeline.title = line.replace("# ", "");
                return;
            } else if (line.startsWith("## ")) {
                const time = line.replace("## ", "");
                const newContent = { time: time, itemList: [] };
                timeline.bucket.push(newContent);
                return;
            }

            if (timeline.bucket.length === 0) {
                throwParseError(idx,  this.i18n.t("error.bodyComeBeforeTime"))
            }

            const lastBucket = timeline.bucket[timeline.bucket.length - 1].itemList;

            // is hr
            if (line === "---" || line === "***") {
                lastBucket.push({ type: "hr" });
                return
            }
            // is heading
            const matchHead = line.match(/^(?<heading>#{3,6})\s(?<lineContent>.+?)$/);
            if (matchHead && matchHead["groups"] && matchHead["groups"]["heading"]) {
                lastBucket.push({ type: "h" + matchHead.groups.heading.length, value: matchHead.groups.lineContent });
                return
            }
            const matchTaskLIst = line.match(/^(\s*)(([-+*])\s*)\[(?<checked>(x|X)| )\]\s+(?<lineContent>.*)/);
            if (matchTaskLIst && matchTaskLIst["groups"]) {
                lastBucket.push({ type: "taskList", checked: matchTaskLIst.groups.checked, value: matchTaskLIst.groups.lineContent });
                return
            }
            // is ul
            const matchUl = line.match(/^[\-*]\s(?<lineContent>.*?)$/);
            if (matchUl && matchUl["groups"]) {
                lastBucket.push({ type: "ul", value: matchUl.groups.lineContent });
                return
            }
            // is ol
            const matchOl = line.match(/^\d\.\s(?<lineContent>.*?)$/);
            if (matchOl && matchOl["groups"]) {
                lastBucket.push({ type: "ol", value: matchOl.groups.lineContent });
                return
            }
            // is blockquote
            const matchQuote = line.match(/^>\s(?<lineContent>.+?)$/);
            if (matchQuote && matchQuote["groups"]) {
                lastBucket.push({ type: "blockquote", value: matchQuote.groups.lineContent });
                return
            }

            // is paragraph
            lastBucket.push({ type: "p", value: line });
        });

        timeline.bucket = timeline.bucket.map(bucket => {
            const items = bucket.itemList.map((item, idx) => {
                switch (item.type) {
                    case "h3":
                    case "h4":
                    case "h5":
                    case "h6":
                    case "p":
                    case "blockquote":
                        return `<${item.type}>${this.utils.markdownInlineStyleToHTML(item.value, dir)}</${item.type}>`
                    case "hr":
                        return `<hr>`
                    case "taskList":
                        const checked = item.checked.trim() ? "checked" : "";
                        const content = this.utils.markdownInlineStyleToHTML(item.value, dir);
                        return `<p class="timeline-task-list"><input type="checkbox" ${checked} disabled><span>${content}</span></p>`;
                    case "ul":
                    case "ol":
                        const value = `<li>${this.utils.markdownInlineStyleToHTML(item.value, dir)}</li>`;
                        const isListStart = idx === 0 || bucket.itemList[idx - 1].type !== item.type;
                        const isListEnd = idx === bucket.itemList.length - 1 || bucket.itemList[idx + 1].type !== item.type;
                        if (isListStart && isListEnd) {
                            return `<${item.type}>${value}</${item.type}>`
                        } else if (isListStart) {
                            return `<${item.type}>${value}`
                        } else if (isListEnd) {
                            return `${value}</${item.type}>`
                        } else {
                            return value
                        }
                }
            });

            return $(`
                <div class="timeline-line"><div class="timeline-circle"></div></div>
                <div class="timeline-wrapper">
                    <div class="timeline-time">${bucket.time}</div>
                    <div class="timeline-event">${items.join("")}</div>
                </div>
            `)
        })
        return timeline
    }
}

module.exports = {
    plugin: timelinePlugin
}
