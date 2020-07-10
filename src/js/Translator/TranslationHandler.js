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
(function (TranslationHandler, undefined) {
    "use strict";
    
    var locales = null;

    function GetLanguageIsoByLcid (lcid) {
        var locByLocales = locales.find(function(loc) { return loc.localeid === lcid; });
       
        if (locByLocales) {
            return locByLocales.code.substr(0, 2);
        }

        var locByColumns = XrmTranslator.GetGrid().columns.find(function(c) { return c.field === lcid});

        if (locByColumns) {
            return locByColumns.caption.substr(0, 2);
        }

        return null;
    }

    const deeplTranslator = function (authKey) {
        var baseUrl = "https://api.deepl.com/v2";
        var translationApiUrl = baseUrl + "/translate?auth_key=[auth_key]&source_lang=[source_lang]&target_lang=[target_lang]&text=[text]&tag_handling=xml";

        function BuildTranslationUrl (fromLanguage, destLanguage, phrase) {
            return translationApiUrl
                .replace("[auth_key]", authKey)
                .replace("[source_lang]", fromLanguage)
                .replace("[target_lang]", destLanguage)
                .replace("[text]", encodeURIComponent(phrase));
        }
    
        this.GetTranslation = function(fromLanguage, destLanguage, phrase) {
            $.support.cors = true;
    
            return WebApiClient.Promise.resolve($.ajax({
                url: BuildTranslationUrl(fromLanguage, destLanguage, phrase),
                type: "GET",
                crossDomain: true,
                dataType: "json"
            }));
        }
        
        this.AddTranslations = function(fromLcid, destLcid, updateRecords, responses) {
            var translations = [];
    
            for (var i = 0; i < updateRecords.length; i++) {
                var response = responses[i];
                var updateRecord = updateRecords[i];
    
                if (response.translations.length > 0) {
                    var decoded = response.translations[0].text.replace(/<escape data="(.*?(?="\/>))"\/>/gi, "$1");
                    var translation = w2utils.encodeTags(decoded);
    
                    var record = XrmTranslator.GetByRecId(updateRecords, updateRecord.recid);
    
                    if (!record) {
                        continue;
                    }
    
                    translations.push({
                        recid: record.recid,
                        schemaName: record.schemaName,
                        column: destLcid,
                        source: record[fromLcid],
                        translation: translation
                    });
                }
            }

            return translations;
        }

        this.CanTranslate = function(fromLcid, destLcid) {
            $.support.cors = true;
    
            return WebApiClient.Promise.resolve($.ajax({
                url: baseUrl + "/languages?auth_key=" + authKey,
                type: "GET",
                crossDomain: true,
                dataType: "json"
            }))
            .then(function(result) {
                const canTranslateSource = result.some(function (l) {
                    return l.language.toLowerCase() === fromLcid.toLowerCase()
                });

                const canTranslateTarget = result.some(function (l) {
                    return l.language.toLowerCase() === destLcid.toLowerCase()
                });

                return {
                    [fromLcid]: canTranslateSource,
                    [destLcid]: canTranslateTarget
                };
            });
        }
    };   

    const azureTranslator = function (authKey) {
        var baseUrl = "https://api.cognitive.microsofttranslator.com";
        var translationApiUrl = baseUrl + "/translate?api-version=3.0&from=[source_lang]&to=[target_lang]&textType=html";
        var languageUrl = baseUrl + "/languages?api-version=3.0";

        function BuildTranslationUrl (fromLanguage, destLanguage) {
            return translationApiUrl
                .replace("[source_lang]", fromLanguage)
                .replace("[target_lang]", destLanguage);
        }
    
        this.GetTranslation = function(fromLanguage, destLanguage, phrase) {
            $.support.cors = true;

            return WebApiClient.Promise.resolve($.ajax({
                url: BuildTranslationUrl(fromLanguage, destLanguage),
                dataType: "json",
                contentType: "application/json",
                type: "POST",
                data: JSON.stringify([{"Text":phrase}]),
                crossDomain: true,
                dataType: "json",
                headers: {
                    "Ocp-Apim-Subscription-Key": authKey
                }
            }));
        }

        this.AddTranslations = function(fromLcid, destLcid, updateRecords, responses) {
            var translations = [];
    
            for (var i = 0; i < updateRecords.length; i++) {
                var response = responses[i][0];
                var updateRecord = updateRecords[i];
    
                if (!response) {
                    continue;
                }

                if (response.translations.length > 0) {
                    var decoded = response.translations[0].text.replace(/<escape data="(.*?(?="\/>))"\/>/gi, "$1");
                    var translation = w2utils.encodeTags(decoded);
    
                    var record = XrmTranslator.GetByRecId(updateRecords, updateRecord.recid);
    
                    if (!record) {
                        continue;
                    }
    
                    translations.push({
                        recid: record.recid,
                        schemaName: record.schemaName,
                        column: destLcid,
                        source: record[fromLcid],
                        translation: translation
                    });
                }
            }

            return translations;
        }

        this.CanTranslate = function(fromLcid, destLcid) {
            $.support.cors = true;
            
            return WebApiClient.Promise.resolve($.ajax({
                url: languageUrl,
                dataType: "json",
                type: "GET",
                crossDomain: true,
                headers: {
                    "Ocp-Apim-Subscription-Key": authKey
                }
            }))
            .then(function(result) {
                const canTranslateSource = !!result.translation[fromLcid.toLowerCase()];
                const canTranslateTarget = !!result.translation[destLcid.toLowerCase()];

                return {
                    [fromLcid]: canTranslateSource,
                    [destLcid]: canTranslateTarget
                };
            });
        }
    };

    TranslationHandler.ApplyTranslations = function (selected, results) {
        var grid = XrmTranslator.GetGrid();
        var savable = false;

        for (var i = 0; i < selected.length; i++) {
            var select = selected[i];

            var result = XrmTranslator.GetByRecId(results, select);
            var record = XrmTranslator.GetByRecId(XrmTranslator.GetAllRecords(), result.recid);

            if (!record) {
                continue;
            }

            if (!record.w2ui) {
                record["w2ui"] = {};
            }

            if (!record.w2ui.changes) {
                record.w2ui["changes"] = {};
            }

            record.w2ui.changes[result.column] = (result.w2ui &&result.w2ui.changes) ? result.w2ui.changes.translation : result.translation;
            savable = true;
            grid.refreshRow(record.recid);
        }

        if (savable) {
            XrmTranslator.SetSaveButtonDisabled(false);
        }
    }

    function ShowTranslationResults (results) {
        if (!w2ui.translationResultGrid) {
            var grid = {
                name: 'translationResultGrid',
                show: { selectColumn: true },
                multiSelect: true,
                columns: [
                    { field: 'schemaName', caption: 'Schema Name', size: '25%', sortable: true, searchable: true },
                    { field: 'column', caption: 'Column LCID', sortable: true, searchable: true, hidden: true },
                    { field: 'source', caption: 'Source Text', size: '25%', sortable: true, searchable: true },
                    { field: 'translation', caption: 'Translated Text', size: '25%', sortable: true, searchable: true, editable: { type: 'text' } }
                ],
                records: []
            };

            $(function () {
                // initialization in memory
                $().w2grid(grid);
            });
        }

        w2ui.translationResultGrid.clear();
        w2ui.translationResultGrid.add(results);

        w2popup.open({
            title   : 'Apply Translation Results',
            buttons   : '<button class="w2ui-btn" onclick="w2popup.close();">Cancel</button> '+
                        '<button class="w2ui-btn" onclick="TranslationHandler.ApplyTranslations(w2ui.translationResultGrid.getSelection(), w2ui.translationResultGrid.records); w2popup.close();">Apply</button>',
            width   : 900,
            height  : 600,
            showMax : true,
            body    : '<div id="main" style="position: absolute; left: 5px; top: 5px; right: 5px; bottom: 5px;"></div>',
            onOpen  : function (event) {
                event.onComplete = function () {
                    $('#w2ui-popup #main').w2render('translationResultGrid');
                    w2ui.translationResultGrid.selectAll();
                };
            },
            onToggle: function (event) {
                $(w2ui.translationResultGrid.box).hide();
                event.onComplete = function () {
                    $(w2ui.translationResultGrid.box).show();
                    w2ui.translationResultGrid.resize();
                }
            }
        });
    }

    function CreateTranslator (apiProvider, authKey) {
        switch ((apiProvider ||"").trim().toLowerCase()) {
            case "deepl":
                return new deeplTranslator(authKey);
            case "azure":
                return new azureTranslator(authKey);
            default:
                return null;
        }
    }

    function FindTranslator(authKey, authProvider, fromLcid, destLcid, preFallBackError) {
        if (!authKey) {
            XrmTranslator.UnlockGrid();
            return [null, "Auth Key is missing, please add one in the config web resource"];
        }

        var translator = CreateTranslator(authProvider, authKey);

        if (!translator) {
            XrmTranslator.UnlockGrid();
            return [null, "Found not supported or missing API Provider, please set one in the config web resource (currently only 'deepl' and 'azure' are supported"];
        }

        return translator.CanTranslate(fromLcid, destLcid)
        .then(function(canTranslate) {
            if (canTranslate[fromLcid] && canTranslate[destLcid]) {
                return [translator];
            }

            const errorMsg = [preFallBackError, authProvider + " translator does not support the current languages: " + fromLcid + "(" + canTranslate[fromLcid] + "), " + destLcid + "(" + canTranslate[destLcid] + ")"]
                .filter(function(e) { return !!e })
                .join("\n");

            return [null, errorMsg];
        })
    }

    TranslationHandler.ProposeTranslations = function(recordsRaw, fromLcid, destLcid, translateMissing) {
        XrmTranslator.LockGrid("Translating...");    

        var records = !translateMissing
            ? recordsRaw
            : recordsRaw.filter(function (record) {
                // If original record had translation set and it was not cleared by pending changes, we skip this record
                if (record[destLcid] && (!record.w2ui || !record.w2ui.changes || record.w2ui.changes[destLcid]) && (translateMissing !== "missingOrIdentical" || record[fromLcid] !== record[destLcid])) {
                    return false;
                }

                return true;
            });

        var fromIso = GetLanguageIsoByLcid(fromLcid);
        var toIso = GetLanguageIsoByLcid(destLcid);

        if (!fromIso || !toIso) {
            XrmTranslator.UnlockGrid();

            w2alert("Could not find source or target language mapping, source iso:" + fromIso + ", target iso: " + toIso);

            return;
        }

        FindTranslator(XrmTranslator.config.translationApiKey, XrmTranslator.config.translationApiProvider, fromIso, toIso)
        .then(function (result) {
            if (!result[0] && XrmTranslator.config.translationApiKeyFallback && XrmTranslator.config.translationApiProviderFallback) {
                return FindTranslator(XrmTranslator.config.translationApiKeyFallback, XrmTranslator.config.translationApiProviderFallback, fromIso, toIso, result[1])
            }
            return result;
        })
        .then(function(result) {
            var translator = result[0];

            if (!translator) {
                w2alert(result[1]);
            }

            var updateRecords = [];
            var translationRequests = [];

            for (var i = 0; i < records.length; i++) {
                var record = records[i];

                // Skip records that have no source text
                if (!record[fromLcid]) {
                    continue;
                }

                const source = XrmTranslator.config.translationExceptions && XrmTranslator.config.translationExceptions.length
                ? XrmTranslator.config.translationExceptions.reduce(function(all, cur) {
                    return (all || "").replace(new RegExp(cur, "gmi"), '<escape data="$1"/>')
                }, record[fromLcid])
                : record[fromLcid]

                updateRecords.push(record);
                translationRequests.push(translator.GetTranslation(fromIso, toIso, w2utils.decodeTags(source)));
            }

            return WebApiClient.Promise.all(translationRequests)
            .then(function (responses) {
                ShowTranslationResults(translator.AddTranslations(fromLcid, destLcid, updateRecords, responses));
                XrmTranslator.UnlockGrid();
            });
        })
        .catch(XrmTranslator.errorHandler);
    }

    function InitializeTranslationPrompt () {
        var languageItems = [];
        var availableLanguages = XrmTranslator.GetGrid().columns;

        for (var i = 0; i < availableLanguages.length; i++) {
            if (availableLanguages[i].field === "schemaName") {
                continue;
            }

            languageItems.push({ id: availableLanguages[i].field, text: availableLanguages[i].caption });
        }

        if (!w2ui.translationPrompt)
        {
            $().w2form({
                name: 'translationPrompt',
                style: 'border: 0px; background-color: transparent;',
                formHTML:
                    '<div class="w2ui-page page-0">'+
                    '    <div class="w2ui-field">'+
                    '        <label>Source Lcid:</label>'+
                    '        <div>'+
                    '           <input name="sourceLcid" type="list"/>'+
                    '        </div>'+
                    '    </div>'+
                    '    <div class="w2ui-field">'+
                    '        <label>Target Lcid:</label>'+
                    '        <div>'+
                    '            <input name="targetLcid" type="list"/>'+
                    '        </div>'+
                    '    </div>'+
                    '    <div class="w2ui-field">'+
                    '        <label>Translate All:</label>'+
                    '        <div>'+
                    '            <input name="translateMissing" type="list"/>'+
                    '        </div>'+
                    '    </div>'+
                    '</div>'+
                    '<div class="w2ui-buttons">'+
                    '    <button class="w2ui-btn" name="cancel">Cancel</button>'+
                    '    <button class="w2ui-btn" name="ok">Ok</button>'+
                    '</div>',
                fields: [
                    { field: 'targetLcid', type: 'list', required: true, options: { items: languageItems } },
                    { field: 'sourceLcid', type: 'list', required: true, options: { items: languageItems } },
                    { field: 'translateMissing', type: 'list', required: false, options: { items: [{id: "", text: "None" }, { id: "missing", text: "All Missing" }, { id: "missingOrIdentical", text: "All Missing Or Identical"}] } }
                ],
                actions: {
                    "ok": function () {
                        this.validate();
                        w2popup.close();

                        XrmTranslator.ShowRecordSelector("TranslationHandler.ProposeTranslations", [this.record.sourceLcid.id, this.record.targetLcid.id, this.record.translateMissing ? this.record.translateMissing.id : ""]);
                    },
                    "cancel": function () {
                        w2popup.close();
                    }
                }
            });
        }
        else {
            // Columns will be different when user switches to portal content snippet or back from it, we need to make sure columns always match current grid columns
            w2ui.translationPrompt.fields[0].options.items = languageItems;
            w2ui.translationPrompt.fields[1].options.items = languageItems;
            
            w2ui.translationPrompt.refresh();
        }

        return Promise.resolve({});
    }

    TranslationHandler.ShowTranslationPrompt = function() {
        InitializeTranslationPrompt()
        .then(function() {
            $().w2popup('open', {
                title   : 'Choose tranlations source and destination',
                name    : 'translationPopup',
                body    : '<div id="form" style="width: 100%; height: 100%;"></div>',
                style   : 'padding: 15px 0px 0px 0px',
                width   : 500,
                height  : 300,
                showMax : true,
                onToggle: function (event) {
                    $(w2ui.translationPrompt.box).hide();
                    event.onComplete = function () {
                        $(w2ui.translationPrompt.box).show();
                        w2ui.translationPrompt.resize();
                    }
                },
                onOpen: function (event) {
                    event.onComplete = function () {
                        // specifying an onOpen handler instead is equivalent to specifying an onBeforeOpen handler, which would make this code execute too early and hence not deliver.
                        $('#w2ui-popup #form').w2render('translationPrompt');
                    }
                }
            });
        });
    }

    function GetLocales () {
        if (locales) {
            return Promise.resolve(locales);
        }

        return WebApiClient.Retrieve({overriddenSetName: "languagelocale", queryParams: "?$select=language,localeid,code"})
        .then(function(result) {
            locales = result.value;

            return locales;
        });
    }

    TranslationHandler.GetLanguageNamesByLcids = function(lcids) {
        return GetLocales()
        .then(function (locales) {
            return lcids.map(function (lcid) {
                var locale = locales.find(function (l) { return l.localeid == lcid }) || {};

                return {
                    lcid: lcid,
                    locale: locale.language || lcid
                };
            });
        });
    }

    TranslationHandler.FillLanguageCodes = function(languages, userSettings, config) {
        var grid = XrmTranslator.GetGrid();

        var languageCount = languages.length;

        return GetLocales()
        .then(function(locales) {
            // 100% full width, minus length of the schema name grid, divided by number of languages is space left for each language
            var columnWidth = (100 - parseInt(grid.columns[0].size.replace("%"))) / languageCount;

            for (var i = 0; i < languages.length; i++) {
                var language = languages[i];
                var locale = locales.find(function (l) { return l.localeid == language }) || {};

                var editable = config.lockedLanguages && config.lockedLanguages.indexOf(language) !== -1 ? null : { type: 'text' };

                grid.addColumn({ field: language, caption: locale.language || language, size: columnWidth + "%", sortable: true, editable: editable });
                grid.addSearch({ field: language, caption: locale.language || language, type: 'text' });

                if (config.hideLanguagesByDefault && language !== userSettings.uilanguageid) {
                    grid.hideColumn(language);
                }
            }

            return languages;
        });
    }

    TranslationHandler.FillPortalLanguageCodes = function(portalLanguages) {
        var grid = XrmTranslator.GetGrid();

        var languages = Object.keys(portalLanguages).map(function(k) { return portalLanguages[k] }).reduce(function(all, cur) { if (!all[cur.adx_PortalLanguageId.adx_lcid.toString()]) { all[cur.adx_PortalLanguageId.adx_lcid.toString()] = cur.adx_PortalLanguageId.adx_languagecode; } return all; }, {});
        
        var lcids = Object.keys(languages);
        var columnWidth = (100 - parseInt(grid.columns[0].size.replace("%"))) / lcids.length;

        for (var i = 0; i < lcids.length; i++) {
            var lcid = lcids[i];

            var editable = { type: 'text' };

            grid.addColumn({ field: lcid, caption: languages[lcid] || lcid, size: columnWidth + "%", sortable: true, editable: editable });
            grid.addSearch({ field: lcid, caption: languages[lcid] || lcid, type: 'text' });
        }

        return languages;
    }

    /**
     * Returns object with adx_websitelanguageid as key and string lcid as value
     */
    TranslationHandler.FindPortalLanguages = function () {
        return WebApiClient.Retrieve({entityName: "adx_websitelanguage", queryParams: "?$select=_adx_websiteid_value&$expand=adx_PortalLanguageId($select=adx_lcid,adx_languagecode,adx_portallanguageid)"})
        .then(function (r) {
            return r.value.map(function(w) { return { id: w.adx_websitelanguageid, data: w }; });
        })
        .then(function (r) {
            return r.reduce(function(all, cur) { all[cur.id] = cur.data; return all; }, {});
        });
    }

    TranslationHandler.GetAvailableLanguages = function() {
        return WebApiClient.Execute(WebApiClient.Requests.RetrieveAvailableLanguagesRequest);
    }
} (window.TranslationHandler = window.TranslationHandler || {}));
