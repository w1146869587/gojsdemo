﻿var GoJsTest = function () {
    var self = this;
    var myDiagram = null;
    var objGo = null;
    this.InitUI = function () {
        InitGoJs1();
    }
    function InitGoJs1() {

        if (window.goSamples) goSamples();  // init for these samples -- you don't need to call this
        objGo = go.GraphObject.make;  // for conciseness in defining templates

        myDiagram =
        objGo(go.Diagram, "myDragramDiv", // must be the ID or reference to div
        {
            initialContentAlignment: go.Spot.Center,
            maxSelectionCount: 1, // users can select only one part at a time
            validCycle: go.Diagram.CycleDestinationTree, // make sure users can only create trees
            "clickCreatingTool.archetypeNodeData": {}, // allow double-click in background to create a new node
            "clickCreatingTool.insertPart": function (loc) {  // customize the data for the new node
                this.archetypeNodeData = {
                    key: getNextKey(), // assign the key based on the number of nodes
                    name: "(new person)",
                    title: ""
                };
                return go.ClickCreatingTool.prototype.insertPart.call(this, loc);
            },
            layout: objGo(go.TreeLayout,
            {
                treeStyle: go.TreeLayout.StyleLastParents,
                arrangement: go.TreeLayout.ArrangementHorizontal,
                // properties for most of the tree:
                angle: 90,
                layerSpacing: 35,
                // properties for the "last parents":
                alternateAngle: 90,
                alternateLayerSpacing: 35,
                alternateAlignment: go.TreeLayout.AlignmentBus,
                alternateNodeSpacing: 20
            }),
            "undoManager.isEnabled": true // enable undo & redo
        });

        // when the document is modified, add a "*" to the title and enable the "Save" button
        //myDiagram.addDiagramListener("Modified", function (e) {
        //    var button = document.getElementById("SaveButton");
        //    if (button) button.disabled = !myDiagram.isModified;
        //    var idx = document.title.indexOf("*");
        //    if (myDiagram.isModified) {
        //        if (idx < 0) document.title += "*";
        //    } else {
        //        if (idx >= 0) document.title = document.title.substr(0, idx);
        //    }
        //});

        // manage boss info manually when a node or link is deleted from the diagram
        myDiagram.addDiagramListener("SelectionDeleting", function (e) {
            
            var part = e.subject.first(); // e.subject is the myDiagram.selection collection,
            // so we'll get the first since we know we only have one selection
            myDiagram.startTransaction("clear boss");
            if (part instanceof go.Node) {
                var it = part.findTreeChildrenNodes(); // find all child nodes
                while (it.next()) { // now iterate through them and clear out the boss information
                    var child = it.value;
                    var bossText = child.findObject("boss"); // since the boss TextBlock is named, we can access it by name
                    if (bossText === null) return;
                    bossText.text = "";
                }
            } else if (part instanceof go.Link) {
                var child = part.toNode;
                var bossText = child.findObject("boss"); // since the boss TextBlock is named, we can access it by name
                if (bossText === null) return;
                bossText.text = "";
            }
            myDiagram.commitTransaction("clear boss");
        });

        var levelColors = ["#AC193D", "#2672EC", "#8C0095", "#5133AB",
                           "#008299", "#D24726", "#008A00", "#094AB2"];

        // override TreeLayout.commitNodes to also modify the background brush based on the tree depth level
        myDiagram.layout.commitNodes = function () {
            go.TreeLayout.prototype.commitNodes.call(myDiagram.layout);  // do the standard behavior
            // then go through all of the vertexes and set their corresponding node's Shape.fill
            // to a brush dependent on the TreeVertex.level value
            myDiagram.layout.network.vertexes.each(function (v) {
                if (v.node) {
                    var level = v.level % (levelColors.length);
                    var color = levelColors[level];
                    var shape = v.node.findObject("SHAPE");
                    if (shape)
                        shape.fill = objGo(go.Brush, "Linear", { 0: color, 1: color, start: go.Spot.Left, end: go.Spot.Right });
                }
            });
        };

        // This function is used to find a suitable ID when modifying/creating nodes.
        // We used the counter combined with findNodeDataForKey to ensure uniqueness.
        function getNextKey() {
            var key = nodeIdCounter;
            while (myDiagram.model.findNodeDataForKey(key) !== null) {
                key = nodeIdCounter--;
            }
            return key;
        }

        var nodeIdCounter = -1; // use a sequence to guarantee key uniqueness as we add/remove/modify nodes

        // when a node is double-clicked, add a child to it
        function nodeDoubleClick(e, obj) {

            var clicked = obj.part;
            if (clicked !== null) {
                var thisemp = clicked.data;
                myDiagram.startTransaction("add employee");
                var newemp = { key: getNextKey(), name: "(new person)", title: "", parent: thisemp.key };
                myDiagram.model.addNodeData(newemp);
                myDiagram.commitTransaction("add employee");
            }
        }

        // this is used to determine feedback during drags
        function mayWorkFor(node1, node2) {
            if (!(node1 instanceof go.Node)) return false;  // must be a Node
            if (node1 === node2) return false;  // cannot work for yourself
            if (node2.isInTreeOf(node1)) return false;  // cannot work for someone who works for you
            return true;
        }

        // This function provides a common style for most of the TextBlocks.
        // Some of these values may be overridden in a particular TextBlock.
        function textStyle() {
            return { font: "9pt  Segoe UI,sans-serif", stroke: "white" };
        }

        // This converter is used by the Picture.
        function findHeadShot(key) {
            if (key < 0 || key > 16) return "images/HSnopic.png"; // There are only 16 images on the server
            return "images/HS" + key + ".png"
        }

        // define the Node template
        myDiagram.nodeTemplate =
          objGo(go.Node, "Auto",
            { doubleClick: nodeDoubleClick },
            { // handle dragging a Node onto a Node to (maybe) change the reporting relationship
                mouseDragEnter: function (e, node, prev) {
                    var diagram = node.diagram;
                    var selnode = diagram.selection.first();
                    if (!mayWorkFor(selnode, node)) return;
                    var shape = node.findObject("SHAPE");
                    if (shape) {
                        shape._prevFill = shape.fill;  // remember the original brush
                        shape.fill = "darkred";
                    }
                },
                mouseDragLeave: function (e, node, next) {
                    var shape = node.findObject("SHAPE");
                    if (shape && shape._prevFill) {
                        shape.fill = shape._prevFill;  // restore the original brush
                    }
                },
                mouseDrop: function (e, node) {
                    var diagram = node.diagram;
                    var selnode = diagram.selection.first();  // assume just one Node in selection
                    if (mayWorkFor(selnode, node)) {
                        // find any existing link into the selected node
                        var link = selnode.findTreeParentLink();
                        if (link !== null) {  // reconnect any existing link
                            link.fromNode = node;
                        } else {  // else create a new link
                            diagram.toolManager.linkingTool.insertLink(node, node.port, selnode, selnode.port);
                        }
                    }
                }
            },
            // for sorting, have the Node.text be the data.name
            new go.Binding("text", "name"),
            // bind the Part.layerName to control the Node's layer depending on whether it isSelected
            new go.Binding("layerName", "isSelected", function (sel) { return sel ? "Foreground" : ""; }).ofObject(),
            // define the node's outer shape
            objGo(go.Shape, "Rectangle",
            {
                name: "SHAPE", fill: "white", stroke: null,
                // set the port properties:
                portId: "", fromLinkable: true, toLinkable: true, cursor: "pointer"
            }),
            objGo(go.Panel, "Horizontal",
              objGo(go.Picture,
                {
                    name: "Picture",
                    desiredSize: new go.Size(39, 50),
                    margin: new go.Margin(6, 8, 6, 10),
                },
                new go.Binding("source", "key", findHeadShot)),
              // define the panel where the text will appear
             objGo(go.Panel, "Table",
                {
                    maxSize: new go.Size(150, 999),
                    margin: new go.Margin(6, 10, 0, 3),
                    defaultAlignment: go.Spot.Left
                },
                objGo(go.RowColumnDefinition, { column: 2, width: 4 }),
                objGo(go.TextBlock, textStyle(),  // the name
                  {
                      row: 0, column: 0, columnSpan: 5,
                      font: "12pt Segoe UI,sans-serif",
                      editable: true, isMultiline: false,
                      minSize: new go.Size(10, 16)
                  },
                  new go.Binding("text", "name").makeTwoWay()),
                objGo(go.TextBlock, "Title: ", textStyle(),
                  { row: 1, column: 0 }),
                objGo(go.TextBlock, textStyle(),
                  {
                      row: 1, column: 1, columnSpan: 4,
                      editable: true, isMultiline: false,
                      minSize: new go.Size(10, 14),
                      margin: new go.Margin(0, 0, 0, 3)
                  },
                  new go.Binding("text", "title").makeTwoWay()),
                objGo(go.TextBlock, textStyle(),
                  { row: 2, column: 0 },
                  new go.Binding("text", "key", function (v) { return "ID: " + v; })),
                objGo(go.TextBlock, textStyle(),
                  { name: "boss", row: 2, column: 3, }, // we include a name so we can access this TextBlock when deleting Nodes/Links
                  new go.Binding("text", "parent", function (v) { return "Boss: " + v; })),
                objGo(go.TextBlock, textStyle(),  // the comments
                  {
                      row: 3, column: 0, columnSpan: 5,
                      font: "italic 9pt sans-serif",
                      wrap: go.TextBlock.WrapFit,
                      editable: true,  // by default newlines are allowed
                      minSize: new go.Size(10, 14)
                  },
                  new go.Binding("text", "comments").makeTwoWay())
              )  // end Table Panel
            ) // end Horizontal Panel
          );  // end Node

        // the context menu allows users to make a position vacant,
        // remove a role and reassign the subtree, or remove a department
        myDiagram.nodeTemplate.contextMenu =
          objGo(go.Adornment, "Vertical",
            objGo("ContextMenuButton",
              objGo(go.TextBlock, "Vacate Position"),
              {
                  click: function (e, obj) {
                      var node = obj.part.adornedPart;
                      if (node !== null) {
                          var thisemp = node.data;
                          myDiagram.startTransaction("vacate");
                          // update the key, name, and comments
                          myDiagram.model.setKeyForNodeData(thisemp, getNextKey());
                          myDiagram.model.setDataProperty(thisemp, "name", "(Vacant)");
                          myDiagram.model.setDataProperty(thisemp, "comments", "");
                          myDiagram.commitTransaction("vacate");
                      }
                  }
              }
            ),
            objGo("ContextMenuButton",
              objGo(go.TextBlock, "Remove Role"),
              {
                  click: function (e, obj) {
                      // reparent the subtree to this node's boss, then remove the node
                      var node = obj.part.adornedPart;
                      if (node !== null) {
                          myDiagram.startTransaction("reparent remove");
                          var chl = node.findTreeChildrenNodes();
                          // iterate through the children and set their parent key to our selected node's parent key
                          while (chl.next()) {
                              var emp = chl.value;
                              myDiagram.model.setParentKeyForNodeData(emp.data, node.findTreeParentNode().data.key);
                          }
                          // and now remove the selected node itself
                          myDiagram.model.removeNodeData(node.data);
                          myDiagram.commitTransaction("reparent remove");
                      }
                  }
              }
            ),
            objGo("ContextMenuButton",
              objGo(go.TextBlock, "Remove Department"),
              {
                  click: function (e, obj) {
                      // remove the whole subtree, including the node itself
                      var node = obj.part.adornedPart;
                      if (node !== null) {
                          myDiagram.startTransaction("remove dept");
                          myDiagram.removeParts(node.findTreeParts());
                          myDiagram.commitTransaction("remove dept");
                      }
                  }
              }
            )
          );

        // define the Link template
        myDiagram.linkTemplate =
          objGo(go.Link, go.Link.Orthogonal,
            { corner: 5, relinkableFrom: true, relinkableTo: true },
            objGo(go.Shape, { strokeWidth: 4, stroke: "#00a4a4" }));  // the link shape


        // read in the JSON-format data from the "mySavedModel" element
        load();


        // support editing the properties of the selected person in HTML
        if (window.Inspector) myInspector = new Inspector("myInspector", myDiagram,
          {
              properties: {
                  "key": { readOnly: true },
                  "comments": {}
              }
          });
    }
    function load() {

      
           var nodeDataArray = [
          { "key": 1, "name": "Stella Payne Diaz", "title": "CEO" },
          { "key": 2, "name": "Luke Warm", "title": "VP Marketing/Sales", "parent": 1 },
          { "key": 3, "name": "Meg Meehan Hoffa", "title": "Sales", "parent": 2 },
          { "key": 4, "name": "Peggy Flaming", "title": "VP Engineering", "parent": 1 },
          { "key": 5, "name": "Saul Wellingood", "title": "Manufacturing", "parent": 4 },
          { "key": 6, "name": "Al Ligori", "title": "Marketing", "parent": 2 },
          { "key": 7, "name": "Dot Stubadd", "title": "Sales Rep", "parent": 3 },
          { "key": 8, "name": "Les Ismore", "title": "Project Mgr", "parent": 5 },
          { "key": 9, "name": "April Lynn Parris", "title": "Events Mgr", "parent": 6 },
          { "key": 10, "name": "Xavier Breath", "title": "Engineering", "parent": 4 },
          { "key": 11, "name": "Anita Hammer", "title": "Process", "parent": 5 },
          { "key": 12, "name": "Billy Aiken", "title": "Software", "parent": 10 },
          { "key": 13, "name": "Stan Wellback", "title": "Testing", "parent": 10 },
          { "key": 14, "name": "Marge Innovera", "title": "Hardware", "parent": 10 },
          { "key": 15, "name": "Evan Elpus", "title": "Quality", "parent": 5 },
          { "key": 16, "name": "Lotta B. Essen", "title": "Sales Rep", "parent": 3 }
            ]
       
           var linkDataArray = [
              {from :1,to:2 },
              {from :1,to:3 },
              {from :1,to:4 },
              {from :1,to:5},
              { from: 6, to: 1 },
              { from: 7, to: 1 },
              { from: 8, to: 1 },
              { from: 9, to: 1 },
             
           ];


          myDiagram.model.nodeDataArray = nodeDataArray; //model.nodeDataArray存储node的数据
          myDiagram.model.linkDataArray = linkDataArray; //model.linkDataArray存储Link的数据

       // myDiagram.model = go.Model.fromJson(aa);
    }
    /////////////////////////
    function InitGoJs2() {
        if (window.goSamples) goSamples();   
        objGo = go.GraphObject.make;
        // 画布
        myDiagram = objGo(go.Diagram, "myDragramDiv", {
            initialContentAlignment: go.Spot.Center,
            // 模型图的中心位置所在坐标
            "undoManager.isEnabled": true
            // 启用Ctrl-Z撤销和Ctrl-Y重做快捷键
        });
        // 模型数据
        var myModel = objGo(go.Model);
        myModel.nodeDataArray = [
            { key:"Alpha",fig:"asfasf" },
            { key: "Beta", fig: "www" },
            { key: "Gamma", fig: "asfaaaasf" }
        ];

        myDiagram.model = myModel;
 
        myDiagram.nodeTemplate =
            objGo(go.Node, "Vertical", new go.Binding("location", "loc"), objGo(go.Shape, "RoundedRectangle", new go.Binding("figure", "fig")),
            objGo(go.TextBlock,"default text", new go.Binding("text", "key"))  );  
    }

    function InitGoJs3() {
        if (window.goSamples) goSamples();  // init for these samples -- you don't need to call this
          objGo = go.GraphObject.make;  // for conciseness in defining templates

        myDiagram =
          objGo(go.Diagram, "myDragramDiv",  // create a Diagram for the DIV HTML element
          {
              initialContentAlignment: go.Spot.Center,
              "undoManager.isEnabled": true
           });

        // This is the actual HTML context menu:
        var cxElement = document.getElementById("contextMenu");

        function showContextMenu(obj, diagram, tool) {

            
           
            // Show only the relevant buttons given the current state.
            var cmd = diagram.commandHandler;
            if (obj == null)
            {
                return;
            }
            if (obj.data.key == "Beta") {
                document.getElementById("cut").style.display = "none";
                document.getElementById("copy").style.display = "none";
                document.getElementById("paste").style.display = "none";
                document.getElementById("delete").style.display = "none";
            }
            else {
                document.getElementById("cut").style.display = "block";
                document.getElementById("copy").style.display = "none";
                document.getElementById("paste").style.display = "none";
                document.getElementById("delete").style.display = "block";
            } 
            document.getElementById("color").style.display = (obj !== null ? "block" : "none");

            // Now show the whole context menu element
            cxElement.style.display = "block";
            // we don't bother overriding positionContextMenu, we just do it here:
            var mousePt = diagram.lastInput.viewPoint;
            cxElement.style.left = mousePt.x + "px";
            cxElement.style.top = mousePt.y + "px";
        }
        // Since we have only one main element, we don't have to declare a hide method,
        // we can set mainElement and GoJS will hide it automatically
        var myContextMenu = objGo(go.HTMLInfo, {
            show: showContextMenu,
            mainElement: cxElement
        });

        // define a simple Node template (but use the default Link template)
        myDiagram.nodeTemplate =
          objGo(go.Node, "Auto",
            { contextMenu: myContextMenu },
            objGo(go.Shape, "RoundedRectangle",
              // Shape.fill is bound to Node.data.color
              new go.Binding("fill", "color")),
            objGo(go.TextBlock,
              { margin: 3 },  // some room around the text
              // TextBlock.text is bound to Node.data.key
              new go.Binding("text", "key"))
          );



        myDiagram.addDiagramListener("SelectionDeleting", function (e) {

            var part = e.subject.first(); // e.subject is the myDiagram.selection collection,
            // so we'll get the first since we know we only have one selection
            myDiagram.startTransaction("clear boss");
            if (part instanceof go.Node) {
                var it = part.findTreeChildrenNodes(); // find all child nodes
                while (it.next()) { // now iterate through them and clear out the boss information
                    var child = it.value;
                    var bossText = child.findObject("boss"); // since the boss TextBlock is named, we can access it by name
                    if (bossText === null) return;
                    bossText.text = "";
                }
            } else if (part instanceof go.Link) {
                var child = part.toNode;
                var bossText = child.findObject("boss"); // since the boss TextBlock is named, we can access it by name
                if (bossText === null) return;
                bossText.text = "";
            }
            myDiagram.commitTransaction("clear boss");
        });

        // create the model data that will be represented by Nodes and Links
        myDiagram.model = new go.GraphLinksModel(
        [
          { key: "Alpha", color: "crimson" },
          { key: "Beta", color: "chartreuse" },
          { key: "Gamma", color: "aquamarine" },
          { key: "Delta", color: "gold" }
        ],
        [
          { from: "Alpha", to: "Beta" },
          { from: "Alpha", to: "Gamma" },
          { from: "Beta", to: "Beta" },
          { from: "Gamma", to: "Delta" },
          { from: "Delta", to: "Alpha" }
        ]);

        myDiagram.contextMenu = myContextMenu;

        // We don't want the div acting as a context menu to have a (browser) context menu!
        cxElement.addEventListener("contextmenu", function (e) {
           
            e.preventDefault();
            return false;
        }, false);

       

    }

    // This is the general menu command handler, parameterized by the name of the command.
    function cxcommand(event, val) {
        if (val === undefined) val = event.currentTarget.id;
        var diagram = myDiagram;
        switch (val) {
            case "cut": diagram.commandHandler.cutSelection(); break;
            case "copy": diagram.commandHandler.copySelection(); break;
            case "paste": diagram.commandHandler.pasteSelection(diagram.lastInput.documentPoint); break;
            case "delete": diagram.commandHandler.deleteSelection(); break;
            case "color": {
                var color = window.getComputedStyle(document.elementFromPoint(event.clientX, event.clientY).parentElement)['background-color'];
                changeColor(diagram, color); break;
            }
        }
        diagram.currentTool.stopTool();
    }

    // A custom command, for changing the color of the selected node(s).
    function changeColor(diagram, color) {
        // Always make changes in a transaction, except when initializing the diagram.
        diagram.startTransaction("change color");
        diagram.selection.each(function (node) {
            if (node instanceof go.Node) {  // ignore any selected Links and simple Parts
                // Examine and modify the data, not the Node directly.
                var data = node.data;
                // Call setDataProperty to support undo/redo as well as
                // automatically evaluating any relevant bindings.
                diagram.model.setDataProperty(data, "color", color);
            }
        });
        diagram.commitTransaction("change color");
    }

}