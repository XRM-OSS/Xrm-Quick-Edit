/* @preserve
 * MIT License
 *
 * Copyright (c) 2017 Florian Krönert
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
*/
(function (ContentSnippetHandler, undefined) {
    "use strict";
    let snippets = [];
    let idSeparator = "|";
    let websites = [];
    let portalLanguages = [];

    function GetWebsiteId (id) {
        var separatorIndex = id.indexOf(idSeparator);

        if (separatorIndex === -1) {
            return id;
        }

        return id.substring(0, separatorIndex);
    }

    function GetPayload (contentSnippet, websiteId, languageId, value) {
        if (!websiteId || !languageId) {
            return undefined;
        }

        return {
            entityName: "adx_contentsnippet",
            entityId: contentSnippet ? contentSnippet.adx_contentsnippetid : undefined,
            entity: {
                adx_value: w2utils.decodeTags(value),
                "adx_websiteid@odata.bind": "/adx_websites(" + websiteId + ")",
                "adx_contentsnippetlanguageid@odata.bind": "/adx_websitelanguages(" + languageId + ")"
            }
        };
    }

    function GetUpdates(records) {
        var updates = [];

        var languageList = Object.keys(portalLanguages).map(function(k) { return portalLanguages[k] });

        for (var i = 0; i < records.length; i++) {
            var record = records[i];

            if (record.w2ui && record.w2ui.changes) {
                var websiteId = GetWebsiteId(record.recid);
                var snippetName = record.recid.replace(websiteId + idSeparator, "");

                var changes = record.w2ui.changes;

                for (var change in changes) {
                    if (!changes.hasOwnProperty(change)) {
                        continue;
                    }

                    // Skip empty data
                    if (!changes[change]) {
                        continue;
                    }

                    var language = languageList.find(function(l) { return l._adx_websiteid_value === websiteId && l.adx_PortalLanguageId.adx_lcid == change });

                    // This will be the case when the language has not been enabled for the website this content snippet belongs to
                    if (!language) {
                        continue;
                    }

                    var snippet = snippets.find(function(s) { return s.adx_name === snippetName && s.adx_contentsnippetlanguageid && s.adx_contentsnippetlanguageid.adx_websitelanguageid ===  language.adx_websitelanguageid });
                    var update = GetPayload(snippet, websiteId, language.adx_websitelanguageid, changes[change]);

                    if (update) {
                        updates.push(update);
                    }
                }
            }
        }

        return updates;
    }

    function HandleSnippets(website, websiteSnippets, records) {
        if (!websiteSnippets || websiteSnippets.length === 0) {
            return;
        }

        var record = {
            recid: website.adx_websiteid,
            schemaName: website.adx_name,
            w2ui: {
                editable: false,
                children: []
            }
        };

        var groupedSnippets = websiteSnippets.reduce(function(all, cur) {
            var key = website.adx_websiteid + idSeparator + cur.adx_name;

            if (all[key]) {
                all[key].push(cur);
            }
            else {
                all[key] = [ cur ];
            }

            return all;
        }, {});

        var keys = Object.keys(groupedSnippets);

        for (var j = 0; j < keys.length; j++) {
            var key = keys[j];
            var snippetsByGroup = groupedSnippets[key];

            var child = {
                recid: key,
                schemaName: key.substr(key.indexOf(idSeparator) + 1)
            };

            for (var k = 0; k < snippetsByGroup.length; k++) {
                var snippet = snippetsByGroup[k];

                if (!snippet.adx_contentsnippetlanguageid) {
                    continue;
                }

                var websiteLanguage = portalLanguages[snippet.adx_contentsnippetlanguageid.adx_websitelanguageid];

                if (!websiteLanguage) {
                    continue;
                }

                var language = websiteLanguage.adx_PortalLanguageId.adx_lcid.toString();

                child[language] = snippet.adx_value;
            }

            record.w2ui.children.push(child);
        }

        records.push(record);
    }

    function FillTable () {
        var grid = XrmTranslator.GetGrid();
        grid.clear();

        var records = [];
        var keys = Object.keys(websites);

        for (var i = 0; i < keys.length; i++) {
            var website = websites[keys[i]];
            var websiteSnippets = snippets.filter(function(s) { return s.adx_websiteid && s.adx_websiteid.adx_websiteid === keys[i] });

            HandleSnippets(website, websiteSnippets, records);
        }

        XrmTranslator.AddSummary(records);
        grid.add(records);
        grid.unlock();
    }

    ContentSnippetHandler.Load = function () {
        snippets = [];
        websites = [];
        portalLanguages = [];

        var grid = XrmTranslator.GetGrid();
        var installedLanguages = XrmTranslator.installedLanguages.LocaleIds.map(function (l) { return l.toString() });

        installedLanguages.forEach(function(l) { grid.removeColumn(l) });

        return (portalLanguages.length === 0 ? TranslationHandler.FindPortalLanguages() : Promise.resolve(null))
        .then(function(languages) {
            if (languages) {
                portalLanguages = languages;
                TranslationHandler.FillPortalLanguageCodes(portalLanguages);
            }

            return WebApiClient.Retrieve({entityName: "adx_contentsnippet", queryParams: "?$select=adx_name,adx_value&$filter=_adx_contentsnippetlanguageid_value ne null&$expand=adx_websiteid($select=adx_websiteid,adx_name),adx_contentsnippetlanguageid($select=adx_websitelanguageid)"});
        })
        .then(function(response) {
            snippets = response.value.map(function (s) { s.adx_value = w2utils.encodeTags(s.adx_value); return s; });
            websites = snippets.reduce(function(all, cur) {
                if (!all[cur.adx_websiteid.adx_websiteid]) {
                    all[cur.adx_websiteid.adx_websiteid] = cur.adx_websiteid;
                }

                return all;
            }, {});

            FillTable()
        })
        .catch(XrmTranslator.errorHandler);
    }

    ContentSnippetHandler.Save = function() {
        XrmTranslator.LockGrid("Saving");

        var records = XrmTranslator.GetGrid().records;
        var updates = GetUpdates(records);

        if (!updates || updates.length === 0) {
            XrmTranslator.LockGrid("Reloading");

            return ContentSnippetHandler.Load();
        }

        return WebApiClient.Promise.resolve(updates)
            .each(function(payload) {
                if (payload.entityId) {
                    return WebApiClient.Update(payload);
                }
                else {
                    return WebApiClient.Create(payload);
                }
            })
            .then(function (response) {
                XrmTranslator.LockGrid("Reloading");

                return ContentSnippetHandler.Load();
            })
            .catch(XrmTranslator.errorHandler);
    }
} (window.ContentSnippetHandler = window.ContentSnippetHandler || {}));
