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
(function (FormHandler, undefined) {
    "use strict";
    var idSeparator = "|";
    
    function GetRecordId (id) {
        var separatorIndex = id.indexOf(idSeparator);
        
        if (separatorIndex === -1) {
            return id;
        }
        
        return id.substring(0, separatorIndex);
    }
    
    function GetOptionValueUpdate (attribute, value, labels) {
        if (!attribute.GlobalOptionSet && !attribute.OptionSet) {
            throw new Error("Either the global option set or the OptionSet have to be passed!");
        }
        
        var update = {
            Value: value,
            Label: { 
                LocalizedLabels: labels 
            },
            MergeLabels: true
        };
        
        if (attribute.GlobalOptionSet) {
            update.OptionSetName = attribute.GlobalOptionSet.Name;
        }
        else{
            var optionSet = attribute.OptionSet;
            
            update.EntityLogicalName = XrmTranslator.GetEntity().toLowerCase();
            update.AttributeLogicalName = attribute.LogicalName;
        }
        
        return update;
    }

    function GetUpdates(records) {
        var updates = [];
        
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            
            if (record.w2ui && record.w2ui.changes) {
                var recordId = GetRecordId(record.recid);
                var attribute = XrmTranslator.GetAttributeById (recordId);
                var optionSetValue = parseInt(record.schemaName);
                var changes = record.w2ui.changes;
            
                var labels = [];                

                for (var change in changes) {
                    if (!changes.hasOwnProperty(change)) {
                        continue;
                    }
                    var label = { LanguageCode: change, Label: changes[change] };
                    labels.push(label);
                }

                if (labels.length < 1) {
                    continue;
                }

                var update = GetOptionValueUpdate(attribute, optionSetValue, labels);    
                updates.push(update);
            }
        }
        
        return updates;
    }
    
    function CreateGridNode (node) {
        if (!node) {
            return null;
        }
        
        return {
            recid: node.id,
            schemaName: node.id,
            w2ui: { 
                children: [] 
            }
        };
    }
    
    function traverseTree (treeWalker, tree) {
        // Dive down
        var child = CreateGridNode(treeWalker.firstChild());
        
        if (!child) {
            return;
        }    
        
        // Push each first child per level
        tree.push(child);        
        traverseTree(treeWalker, child.w2ui.children);
        
        // We'll dive up level to level now and add all siblings
        while (treeWalker.nextSibling()) {
            var sibling = CreateGridNode(treeWalker.currentNode);            
            tree.push(sibling);            
            traverseTree(treeWalker, sibling.w2ui.children);
        }

        treeWalker.parentNode();
    }

    function ElementChecker (node) {
        if (node.id && node.getElementsByTagName("labels").length > 0) {
            return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
    }
    
    function FillTable () {
        var grid = XrmTranslator.GetGrid();
        grid.clear();
        
        var parser = new DOMParser();
        var formXml = parser.parseFromString(XrmTranslator.metadata.formxml, "text/xml");
        var treeWalker = document.createTreeWalker(formXml, NodeFilter.SHOW_ALL, ElementChecker, false);

        var records = [];
    
        traverseTree(treeWalker, records);
      
        grid.add(records);
        grid.unlock();
    }
    
    function ShowFormSelection (forms) {
        if (!w2ui.formSelection) {
            var formItems = [];
            
            for (var i = 0; i < forms.length; i++) {
                var form = forms[i];
                
                formItems.push({
                    id: form.formid, 
                    text: form.name + " - " + form.description
                });
            }
            
            $().w2form({
                name: 'formSelectionPrompt',
                style: 'border: 0px; background-color: transparent;',
                formHTML: 
                    '<div class="w2ui-page page-0">'+
                    '    <div class="w2ui-field">'+
                    '        <label>Form:</label>'+
                    '        <div>'+
                    '           <input name="formSelection" type="list" />'+
                    '        </div>'+
                    '    </div>'+
                    '</div>'+
                    '<div class="w2ui-buttons">'+
                    '    <button class="w2ui-btn" name="cancel">Cancel</button>'+
                    '    <button class="w2ui-btn" name="ok">Ok</button>'+
                    '</div>',
                fields: [
                    { field: 'formSelection', type: 'list', required: true, options: { items: formItems } }
                ],
                actions: {
                    "ok": function () { 
                        this.validate(); 
                        
                        var selectedForm = null;
                        for (var i = 0; i < forms.length; i++) {
                            var form = forms[i];
                            
                            if (form.formid === this.record.formSelection.id) {
                                selectedForm = form;
                                break;
                            }
                        }
                        
                        XrmTranslator.metadata = selectedForm;                        
                        FillTable();
                        
                        w2popup.close();
                    },
                    "cancel": function () {
                        XrmTranslator.UnlockGrid();
                        w2popup.close();
                    }
                }
            });
        }
        
        $().w2popup('open', {
            title   : 'Choose Form',
            name    : 'formSelectionPopup',
            body    : '<div id="form" style="width: 100%; height: 100%;"></div>',
            style   : 'padding: 15px 0px 0px 0px',
            width   : 500,
            height  : 300, 
            showMax : true,
            onToggle: function (event) {
                $(w2ui.formSelection.box).hide();
                event.onComplete = function () {
                    $(w2ui.formSelection.box).show();
                    w2ui.formSelection.resize();
                }
            },
            onOpen: function (event) {
                event.onComplete = function () {
                    // specifying an onOpen handler instead is equivalent to specifying an onBeforeOpen handler, which would make this code execute too early and hence not deliver.
                    $('#w2ui-popup #form').w2render('formSelectionPrompt');
                }
            }
        });
    }
    
    FormHandler.Load = function () {
        var entityName = XrmTranslator.GetEntity();
        var entityMetadataId = XrmTranslator.entityMetadata[entityName];
        
        var request = {
            entityName: "systemform", 
            queryParams: "?$filter=objecttypecode eq '" + entityName.toLowerCase() + "'"
        };
        
        WebApiClient.Retrieve(request)
            .then(function(response){
                var forms = response.value;
                
                ShowFormSelection(forms);
            })
            .catch(XrmTranslator.errorHandler);
    }
    
    FormHandler.Save = function() {
        XrmTranslator.LockGrid("Saving");
        
        var records = XrmTranslator.GetGrid().records;        
        var updates = GetUpdates(records);
        
        Promise.resolve(updates)
            .each(function(payload) {
                return WebApiClient.SendRequest("POST", WebApiClient.GetApiUrl() + "UpdateOptionValue", payload);
            })
            .then(function (response){
                XrmTranslator.LockGrid("Publishing");
                
                return XrmTranslator.Publish();
            })
            .then(function (response) {
                XrmTranslator.LockGrid("Reloading");
                
                return FormHandler.Load();
            })
            .catch(XrmTranslator.errorHandler);
    }
} (window.FormHandler = window.FormHandler || {}));
