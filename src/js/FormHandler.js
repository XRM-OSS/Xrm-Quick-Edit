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
    
    function GetParsedForm () {
        var parser = new DOMParser();
        var formXml = parser.parseFromString(XrmTranslator.metadata.formxml, "text/xml");
        
        return formXml;
    }
    
    function NodesWithIdAndLabels (node) {
        if (node.id && node.getElementsByTagName("labels").length > 0) {
            return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
    }
    
    function CreateTreeWalker(elementFilter, formXml) {
        if (!formXml) {
            formXml = GetParsedForm();
        }
        var treeWalker = document.createTreeWalker(formXml, NodeFilter.SHOW_ALL, elementFilter, false);
        
        return treeWalker;
    }
    
    function TraverseTree (treeWalker, tree) {
        // Dive down
        var child = CreateGridNode(treeWalker.firstChild());
        
        if (!child) {
            return;
        }    
        
        // Push each first child per level
        tree.push(child);        
        TraverseTree(treeWalker, child.w2ui.children);
        
        // We'll dive up level to level now and add all siblings
        while (treeWalker.nextSibling()) {
            var sibling = CreateGridNode(treeWalker.currentNode);            
            tree.push(sibling);            
            TraverseTree(treeWalker, sibling.w2ui.children);
        }

        treeWalker.parentNode();
    }

    function GetUpdates(records) {
        var updates = [];
        
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            
            if (record.w2ui && record.w2ui.changes) {
                var changes = record.w2ui.changes;
            
                var labels = [];                

                for (var change in changes) {
                    if (!changes.hasOwnProperty(change)) {
                        continue;
                    }
                    var label = { LanguageCode: change, Text: changes[change] };
                    labels.push(label);
                }

                if (labels.length < 1) {
                    continue;
                }

                updates.push({
                    id: record.recid,
                    labels: labels
                });
            }
        }
        
        return updates;
    }
    
    function GetLabels(node) {
        var labelsNode = null;
        var children = node.children;
        
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            
            if (child && child.tagName === "labels") {
                labelsNode = child;
                break;
            }
        }
        
        return labelsNode;
    }
    
    function AttachLabels(node, gridNode) {
        var labels = GetLabels(node);
        
        if (!labels) {
            return;
        }
        
        for (var i = 0; i < labels.children.length; i++) {
            var label = labels.children[i];
            
            var text = label.attributes["description"].value;
            var languageCode = label.attributes["languagecode"].value;
            
            gridNode[languageCode] = text;
        }
    }
    
    function CreateGridNode (node) {
        if (!node) {
            return null;
        }
        
        var attributes = node.attributes;
        var name = "";
        
        if (attributes["name"]) {
            name = attributes["name"].value;
        }
        else {
            // var nodeid =  attributes["id"].value;
            name = node.tagName;
        }        
        
        var gridNode = {
            recid: node.id,
            schemaName: name,
            w2ui: { 
                children: [] 
            }
        };
        
        AttachLabels(node, gridNode);
        
        return gridNode;
    }
    
    function FillTable () {
        var grid = XrmTranslator.GetGrid();
        grid.clear();

        var records = [];
        
        var treeWalker = CreateTreeWalker(NodesWithIdAndLabels);
        TraverseTree(treeWalker, records);
      
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
    
    function IdFilter (node) {
        if (node.id == this.id) {
            return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
    }
    
    function GetById (id, formXml) {
        var treeWalker = CreateTreeWalker(IdFilter.bind({ id: id }), formXml);
        
        return treeWalker.nextNode();
    }
    
    function ApplyLabelUpdates (labels, updates, formXml) {
        for (var i = 0; i < updates.length; i++) {
            var update = updates[i];
            
            for (var j = 0; j < labels.children.length; j++) {
                var label = labels.children[j];
                
                if (update.LanguageCode === label.attributes["languagecode"].value) {
                    label.attributes["description"].value = update.Text;
                }
                // We did not find it
                else if (j === labels.children.length - 1) {
                    var newLabel = formXml.createElement("label");
                    
                    newLabel.setAttribute("description", update.Text);
                    newLabel.setAttribute("languagecode", update.LanguageCode);
                    
                    labels.appendChild(newLabel);
                }
            }
        }
    }
    
    function SerializeXml(formXml) {
        var serializer = new XMLSerializer();
        
        return serializer.serializeToString(formXml);
    }
    
    function ApplyUpdates(updates, formXml) {
        for (var i = 0; i < updates.length; i++) {
            var update = updates[i];
            
            var node = GetById(update.id, formXml);
            var labels = GetLabels(node);
            
            ApplyLabelUpdates(labels, update.labels, formXml);
        }
        
        var serialized = SerializeXml(formXml);
        
        return {
            formxml: serialized
        };
    }
    
    FormHandler.Load = function () {
        var entityName = XrmTranslator.GetEntity();
        var entityMetadataId = XrmTranslator.entityMetadata[entityName];
        
        var request = {
            entityName: "systemform", 
            queryParams: "?$filter=objecttypecode eq '" + entityName.toLowerCase() + "' and iscustomizable/Value eq true and formactivationstate eq 1"
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
        var formXml = GetParsedForm();
        var updates = GetUpdates(records);
        
        var update = ApplyUpdates(updates, formXml);
        
        WebApiClient.Update({
            entityName: "systemform",
            entityId: XrmTranslator.metadata.formid,
            entity: update
        })
        .then(function (response){
            XrmTranslator.LockGrid("Publishing");
            
            return XrmTranslator.Publish();
        })
        .then(function (response) {
            XrmTranslator.LockGrid("Reloading");
            
            return WebApiClient.Retrieve({
                entityName: "systemform",
                entityId: XrmTranslator.metadata.formid
            });
        })
        .then(function (response) {
            XrmTranslator.metadata = response;                        
            FillTable();
        })
        .catch(XrmTranslator.errorHandler);
    }
} (window.FormHandler = window.FormHandler || {}));
