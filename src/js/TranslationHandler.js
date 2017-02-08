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
   
    var availableLanguages = [];
    var languageMappings = null;
    var translationApiUrl = "https://glosbe.com/gapi/translate?from=[sourceLanguage]&dest=[destLanguage]&format=json&phrase=[phrase]&pretty=true&tm=false&callback=?";
    
    /// Thanks to http://www.chaholl.com/archive/2013/05/07/iso-639-2-to-windows-lcid-mapping.aspx for the mappings
    function GetLanguageIsoByLcid (lcid) {
        if (!languageMappings) {
            languageMappings = {};
        
            languageMappings[1076] = "afr";
            languageMappings[1118] = "ara";
            languageMappings[1068] = "aze";
            languageMappings[1059] = "bel";
            languageMappings[1026] = "bul";
            languageMappings[1027] = "cat";
            languageMappings[2052] = "zho";
            languageMappings[1050] = "hrv";
            languageMappings[1029] = "ces";
            languageMappings[1030] = "dan";
            languageMappings[1125] = "div";
            languageMappings[1043] = "nld";
            languageMappings[1033] = "eng";
            languageMappings[1061] = "est";
            languageMappings[1080] = "fao";
            languageMappings[1035] = "fin";
            languageMappings[1036] = "fra";
            languageMappings[1110] = "glg";
            languageMappings[1079] = "kat";
            languageMappings[1031] = "deu";
            languageMappings[1032] = "ell";
            languageMappings[1095] = "guj";
            languageMappings[1037] = "heb";
            languageMappings[1081] = "hin";
            languageMappings[1038] = "hun";
            languageMappings[1039] = "isl";
            languageMappings[1057] = "ind";
            languageMappings[1040] = "ita";
            languageMappings[1041] = "jpn";
            languageMappings[1099] = "kan";
            languageMappings[1087] = "kaz";
            languageMappings[1089] = "swa";
            languageMappings[1042] = "kor";
            languageMappings[1088] = "kir";
            languageMappings[1062] = "lav";
            languageMappings[1063] = "lit";
            languageMappings[1071] = "mkd";
            languageMappings[1086] = "msa";
            languageMappings[1102] = "mar";
            languageMappings[1104] = "mon";
            languageMappings[1044] = "nor";
            languageMappings[1045] = "pol";
            languageMappings[1046] = "por";
            languageMappings[1094] = "pan";
            languageMappings[1048] = "ron";
            languageMappings[1049] = "rus";
            languageMappings[1103] = "san";
            languageMappings[2074] = "srp";
            languageMappings[1051] = "slk";
            languageMappings[1060] = "slv";
            languageMappings[1034] = "spa";
            languageMappings[1053] = "swe";
            languageMappings[1097] = "tam";
            languageMappings[1092] = "tat";
            languageMappings[1098] = "tel";
            languageMappings[1054] = "tha";
            languageMappings[1055] = "tur";
            languageMappings[1058] = "ukr";
            languageMappings[1056] = "urd";
            languageMappings[1091] = "uzb";
            languageMappings[1066] = "vie";
        }
        
        return languageMappings[lcid];
    }
    
    function BuildTranslationUrl (fromLanguage, destLanguage, phrase) {
        return translationApiUrl
            .replace("?from=[sourceLanguage]", "?from=" + fromLanguage)
            .replace("&dest=[destLanguage]", "&dest=" + destLanguage)
            .replace("&phrase=[phrase]", "&phrase=" + encodeURIComponent(phrase));
    }
    
    function GetTranslation(fromLanguage, destLanguage, phrase) {
        $.support.cors = true;
        
        return Promise.resolve($.ajax({
            url: BuildTranslationUrl(fromLanguage, destLanguage, phrase),
            type: "GET",
            crossDomain: true,
            dataType: "json"
        }));
    }
    
    function CapitalizeFirstChar (text) {
        if (!text) {
            return "";
        }
        
        return text[0].toUpperCase() + text.substring(1);
    }
    
    function AddTranslations(fromLcid, destLcid, updateRecords, responses) {
        var savable = false;
        
        for (var i = 0; i < responses.length; i++) {
            var response = responses[i];
            
            if (response.tuc.length > 0) {
                var translation = response.tuc[0].phrase.text;
                var phrase = response.phrase;
                
                var record = XrmTranslator.GetRecord(updateRecords, function (r) {
                    if (r[fromLcid] === phrase) {
                        return true;
                    }
                    return false;
                });
                
                if (!record) {
                    continue;
                }
                
                if (!record.w2ui) {
                    record["w2ui"] = {};
                }
                
                if (!record.w2ui.changes) {
                    record.w2ui["changes"] = {};
                }
                
                record.w2ui.changes[destLcid] = CapitalizeFirstChar(translation);
                
                savable = true;
                
                XrmTranslator.GetGrid().refreshRow(record.recid);
            }
        }
        
        if (savable) {
            var saveButton = w2ui.grid_toolbar.get("w2ui-save");
            saveButton.disabled = false;
            w2ui.grid_toolbar.refresh();
        }
        
        return savable;
    }
    
    function ProposeTranslations(fromLcid, destLcid) {
        XrmTranslator.LockGrid("Translating...");
        
        var records = XrmTranslator.GetGrid().records;
        var updateRecords = [];
        var translationRequests = [];
        
        var fromIso = GetLanguageIsoByLcid(fromLcid);
        var toIso = GetLanguageIsoByLcid(destLcid);
        
        if (!fromIso || !toIso) {
            XrmTranslator.UnlockGrid();
            
            w2alert("Could not find source or target language mapping, source iso:" + fromIso + ", target iso: " + toIso);
            
            return;
        }
        
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            
            // If original record had translation set and it was not cleared by pending changes, we skip this record
            if (record[destLcid] && (!record.w2ui || !record.w2ui.changes || record.w2ui.changes[destLcid])) {
                continue;
            }
            
            updateRecords.push(record);
            translationRequests.push(GetTranslation(fromIso, toIso, record[fromLcid]));
        }
        
        Promise.all(translationRequests)
            .then(function (responses) {
                AddTranslations(fromLcid, destLcid, updateRecords, responses);
                XrmTranslator.UnlockGrid();
            })
            .catch(XrmTranslator.errorHandler);
    }
    
    TranslationHandler.ShowTranslationPrompt = function() {
        if (!w2ui.translationPrompt) {
            var languageLcids = [];
            
            for (var i = 0; i < availableLanguages.length; i++) {
                languageLcids.push(availableLanguages[i].toString());
            }
            
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
                    '</div>'+
                    '<div class="w2ui-buttons">'+
                    '    <button class="w2ui-btn" name="cancel">Cancel</button>'+
                    '    <button class="w2ui-btn" name="ok">Ok</button>'+
                    '</div>',
                fields: [
                    { field: 'targetLcid', type: 'list', required: true, options: { items: languageLcids } },
                    { field: 'sourceLcid', type: 'list', required: true, options: { items: languageLcids } }
                ],
                actions: {
                    "ok": function () { 
                        this.validate(); 
                        w2popup.close();
                        ProposeTranslations(this.record.sourceLcid.id, this.record.targetLcid.id);
                    },
                    "cancel": function () {
                        w2popup.close();
                    }
                }
            });
        }
        
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
    }
        
    TranslationHandler.FillLanguageCodes = function(languages) {
        availableLanguages = languages;
        var grid = XrmTranslator.GetGrid();
        
        var languageCount = languages.length;
        
        // 100% full width, minus length of the schema name grid, divided by number of languages is space left for each language
        var columnWidth = (100 - parseInt(grid.columns[0].size.replace("%"))) / languageCount;
        
        for (var i = 0; i < languages.length; i++) {
            var language = languages[i];
            
            grid.addColumn({ field: language, caption: language, size: columnWidth + "%", editable: { type: 'text' } });
            grid.addSearch({ field: language, caption: language, type: 'text' });
        }
        
        return languages;
    }
    
    TranslationHandler.GetAvailableLanguages = function() {
        var request = {
            // Yes, we're abusing it. Might add a function parameter to the request some time
            overriddenSetName: "RetrieveAvailableLanguages"
        };

        return WebApiClient.Retrieve(request);
    }
} (window.TranslationHandler = window.TranslationHandler || {}));