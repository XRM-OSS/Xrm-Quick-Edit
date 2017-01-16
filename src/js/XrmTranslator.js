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
(function (XrmTranslator, undefined) {
    "use strict";
    
    var entityMetadata = {};
    var attributeMetadata = [];
    var availableLanguages = [];
    var languageMappings = null;
    var translationApiUrl = "https://glosbe.com/gapi/translate?from=[sourceLanguage]&dest=[destLanguage]&format=json&phrase=[phrase]&pretty=true&tm=false&callback=?";
    
    var currentEntity = null;
    
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
    
    function SchemaNameComparer (e1, e2) {
        if (e1.SchemaName < e2.SchemaName) {
            return -1;
        }
        
        if (e1.SchemaName > e2.SchemaName) {
            return 1;
        }
        
        return 0;
    }
    
    function GetGrid () {
        return w2ui.grid;
    }
    
    function LockGrid (message) {
        GetGrid().lock(message, true);
    }
    
    function UnlockGrid () {
        GetGrid().unlock();
    }
    
    function FillTable () {
        w2ui.grid.clear();
        
        var records = [];
        
        for (var i = 0; i < attributeMetadata.length; i++) {
            var attribute = attributeMetadata[i];

            var displayNames = attribute.DisplayName.LocalizedLabels;
            
            if (!displayNames || displayNames.length === 0) {
                continue;
            }
            
            var record = {
               recid: attribute.MetadataId,
               schemaName: attribute.SchemaName
            };
            
            for (var j = 0; j < displayNames.length; j++) {
                var displayName = displayNames[j];
                
                record[displayName.LanguageCode.toString()] = displayName.Label;
            }
            
            records.push(record);
        }
        
        w2ui.grid.add(records);
        w2ui.grid.unlock();
    }
    
    function LoadOptionSets (entityName) {
        var entityMetadataId = entityMetadata[entityName];
        
        var request = {
            entityName: "EntityDefinition", 
            entityId: entityMetadataId, 
            queryParams: "/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet"
        };
        
        WebApiClient.Retrieve(request)
            .then(function(response){
                debugger;
            })
            .catch(function(error) {
                alert(error)
            });
    }
    
    function LoadEntityAttributes (entityName) {
        var entityMetadataId = entityMetadata[entityName];
        
        var request = {
            entityName: "EntityDefinition",
            entityId: entityMetadataId,
            queryParams: "/Attributes?$filter=IsCustomizable/Value eq true and IsLogical eq false"
        };
        
        WebApiClient.Retrieve(request)
            .then(function(response) {
                var attributes = response.value.sort(SchemaNameComparer);
                attributeMetadata = attributes;
                
                FillTable();
            })
            .catch(function(error) {
               alert(error); 
            });
    }
    
    function GetAttributeById (id) {
        for (var i = 0; i < attributeMetadata.length; i++) {
            var attribute = attributeMetadata[i];
            
            if (attribute.MetadataId === id) {
                return attribute;
            }
        }
        
        return null;
    }
    
    function ApplyChanges(changes, labels) {
        for (var change in changes) {
            if (!changes.hasOwnProperty(change)) {
                continue;
            }
            
            for (var i = 0; i < labels.length; i++) {
                var label = labels[i];
                
                if (label.LanguageCode == change) {
                    label.Label = changes[change];
                    label.HasChanged = true;
                    
                    break;
                }
                
                // Did not find label for this language
                if (i === labels.length - 1) {
                    labels.push({ LanguageCode: change, Label: changes[change] })
                }
            }
        }
    }
    
    function GetUpdates () {
        var records = w2ui.grid.records;
        
        var updates = [];
        
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            
            if (record.w2ui && record.w2ui.changes) {
                var attribute = GetAttributeById (record.recid);
                var labels = attribute.DisplayName.LocalizedLabels;
                
                var changes = record.w2ui.changes;
                
                ApplyChanges(changes, labels);
                updates.push(attribute);
            }
        }
        
        return updates;
    }
    
    function Publish() {
        var xml = "<importexportxml><entities><entity>" + currentEntity.toLowerCase() + "</entity></entities></importexportxml>";
        
        return WebApiClient.SendRequest("POST", WebApiClient.GetApiUrl() + "PublishXml", { ParameterXml: xml });
    }
    
    function Save() {
        LockGrid("Saving");
        
        var updates = GetUpdates();
        
        var requests = [];
        var entityUrl = WebApiClient.GetApiUrl() + "EntityDefinitions(" + entityMetadata[currentEntity] + ")/Attributes(";
        
        for (var i = 0; i < updates.length; i++) {
            var update = updates[i];
            var url = entityUrl + update.MetadataId + ")";
            
            var request = WebApiClient.SendRequest("PUT", url, update, [{key: "MSCRM.MergeLabels", value: "true"}]);
            requests.push(request);
        }
        
        Promise.all(requests)
            .then(function (response){
                LockGrid("Publishing");
                
                return Publish();
            })
            .then(function (response) {
                LockGrid("Reloading");
                
                return LoadEntityAttributes(currentEntity);
            })
            .then(function (response) {
                UnlockGrid();
            })
            .catch(function (error) {
                alert(error);
            });
    }
    
    function GetRecord (records, selector) {
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            
            if (selector(record)) {
                return record;
            }
        }
        
        return null;
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
                
                var record = GetRecord(updateRecords, function (r) {
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
                
                GetGrid().refreshRow(record.recid);
            }
        }
        
        if (savable) {
            var saveButton = w2ui.grid_toolbar.get("w2ui-save");
            saveButton.disabled = false;
            w2ui.grid_toolbar.refresh();
        }
    }
    
    function ProposeTranslations(fromLcid, destLcid) {
        LockGrid("Translating...");
        
        var records = GetGrid().records;
        var updateRecords = [];
        var translationRequests = [];
        
        var fromIso = GetLanguageIsoByLcid(fromLcid);
        var toIso = GetLanguageIsoByLcid(destLcid);
        
        if (!fromIso || !toIso) {
            UnlockGrid();
            
            alert("Could not find source or target language mapping, source iso:" + fromIso + ", target iso: " + toIso);
            
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
                UnlockGrid();
            })
            .catch(function(error) {
                if (error.statusText) {
                    alert("Error: " + error.statusText);
                }
                else {
                    alert("Error: " + error);
                }
                UnlockGrid();
            });
    }
    
    function ShowTranslationPrompt () {
        if (!w2ui.foo) {
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
                        
                        ProposeTranslations(this.record.sourceLcid.id, this.record.targetLcid.id);
                        w2popup.close();
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
                $(w2ui.foo.box).hide();
                event.onComplete = function () {
                    $(w2ui.foo.box).show();
                    w2ui.foo.resize();
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
          
    function InitializeGrid (entities) {        
        $('#grid').w2grid({ 
            name: 'grid', 
            show: { 
                toolbar: true,
                footer: true,
                toolbarSave: true
            },
            multiSearch: true,
            columns: [                
                { field: 'recid', caption: 'Metadata ID', size: '50px', sortable: true, resizable: true, hidden: true },
                { field: 'schemaName', caption: 'Schema Name', size: '200px', sortable: true, resizable: true }
            ],
            onSave: function (event) {
                Save();
            },
            toolbar: {
                items: [
                    { type: 'button', id: 'autoTranslate', text: 'Auto Translate' },
                    { type: 'menu-radio', id: 'type', icon: 'fa-star',
                        text: function (item) {
                            var text = item.selected;
                            var el   = this.get('type:' + item.selected);
                            return 'Type: ' + el.text;
                        },
                        selected: 'attributes',
                        items: [
                            { id: 'attributes', text: 'Attributes', icon: 'fa-camera' }
                            //, { id: 'options', text: 'Options', icon: 'fa-picture' }
                        ]
                    },
                    { type: 'menu-radio', id: 'entitySelect', icon: 'fa-star',
                        text: function (item) {
                            var text = item.selected;
                            var el = this.get('entitySelect:' + item.selected);
                            
                            if (el) {
                                return 'Entity: ' + el.text;
                            }
                            else {
                                return "Choose entity";
                            }
                        },
                        items: []
                    }
                ],
                onClick: function(event) {
                    var target = event.target;
                    
                    if (target === "autoTranslate") {
                        ShowTranslationPrompt();
                    }
                    else if (target.indexOf("entitySelect:") !== -1) {
                        var entity = target.substring(target.indexOf(":") + 1);
                        
                        currentEntity = entity;
                        
                        LockGrid("Loading " + entity + " attributes");
                        LoadEntityAttributes(entity);
                    }
                }
            }
        }); 
        
        LockGrid("Loading entities");
    }
    
    function FillEntitySelector (entities) {
        entities = entities.sort(SchemaNameComparer);
        var entitySelect = w2ui.grid_toolbar.get("entitySelect").items;
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            
            entitySelect.push(entity.SchemaName);
            entityMetadata[entity.SchemaName] = entity.MetadataId;
        }
        
        return entities;
    }
    
    function FillLanguageCodes (languages) {
        availableLanguages = languages;
        
        for (var i = 0; i < languages.length; i++) {
            var language = languages[i];
            
            w2ui.grid.addColumn({ field: language, caption: language, size: '120px', editable: { type: 'text' } });
        }
        
        return languages;
    }
    
    function GetEntities() {
        var request = {
            entityName: "EntityDefinition",
            queryParams: "?$select=SchemaName,MetadataId&$filter=IsCustomizable/Value eq true"
        };

        return WebApiClient.Retrieve(request);
    }
    
    function GetAvailableLanguages () {
        var request = {
            // Yes, we're abusing it. Might add a function parameter to the request some time
            overriddenSetName: "RetrieveAvailableLanguages"
        };

        return WebApiClient.Retrieve(request);
    }
    
    XrmTranslator.Initialize = function() {
        InitializeGrid(); 
        
        GetEntities()
            .then(function(response){
                return FillEntitySelector(response.value);
            })
            .then(function (){
                return GetAvailableLanguages();
            })
            .then(function(languages) {
                return FillLanguageCodes(languages.LocaleIds);
            })
            .then(function (){
                w2ui.grid.unlock();
            })
            .catch(function(error) {
                alert(error.Message);
            });
    }
} (window.XrmTranslator = window.XrmTranslator || {}));