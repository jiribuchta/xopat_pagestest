sleep = function (ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
};

OSDAnnotations = function (incoming) {
	this.id = "openseadragon_image_annotations";
	PLUGINS.each[this.id].instance = this;

	this.DEFAULT_LEFT_LABEL = "Left Click";
	this.DEFAULT_RIGHT_LABEL = "Right Click";

	this.overlay = null;
	this.Modes = Object.freeze({
		AUTO: 0,
		CUSTOM: 1,
		EDIT: 2,
		FREE_FORM_TOOL: 3,
	});

	/*
	Global setting to show/hide annotations on default
	*/
	this.showAnnotations = true;
	/* Annotation property related data */
	this.currentAnnotationObject = "rect";
	this.currentAnnotationObjectUpdater = null; //if user drags what function is being used to update
	this.annotationType = "rect";
	this.currentAnnotationColor = "#ff2200";

	this.alphaSensitivity = 65; //at what threshold the auto region outline stops

	// Assign from incoming terms
	for (var key in incoming) {
		this[key] = incoming[key];
	}

	// Classes defined in other local JS files
	this.messenger = new Messenger();
	this.history = new History(this);
	this.modifyTool = new FreeFormTool(this);

	// Annotation Objects
	this.polygon = new Polygon(this);
	this.ellipse = new Ellipse(this);
	this.rectangle = new Rect(this);
};

OSDAnnotations.prototype = {

	/*
	Initialize member variables
	*/
	initialize: function (imageJson, options) {


		/* OSD values used by annotations */
		this.currentTile = "";
		this.overlay = PLUGINS.osd.fabricjsOverlay(options);

		this.setMouseOSDInteractive(true);

		// draw annotation from json file
		//todo try catch error MSG if fail
		// todo allow user to load his own annotations (probably to a separate layer)
		if (imageJson) {
			this.overlay.fabricCanvas().loadFromJSON(imageJson, this.overlay.fabricCanvas().renderAll.bind(this.overlay.fabricCanvas()));
		}


		PLUGINS.appendToMainMenuExtended("Annotations", `
<span class="material-icons" onclick="$('#help').css('display', 'block');" title="Help" style="cursor: pointer;float: right;">help</span>
<span class="material-icons" id="downloadAnnotation" title="Export annotations" style="cursor: pointer;float: right;">download</span>
<!-- <button type="button" class="btn btn-secondary" autocomplete="off" id="sendAnnotation">Send</button> -->

<span class="material-icons" title="Enable/disable annotations" style="cursor: pointer;float: right;" data-ref="on" onclick="
if ($(this).attr('data-ref') === 'on'){
	openseadragon_image_annotations.turnAnnotationsOnOff(false);
	$(this).html('visibility_off');
	$(this).attr('data-ref', 'off');
} else {
	openseadragon_image_annotations.turnAnnotationsOnOff(true);
	$(this).html('visibility');
	$(this).attr('data-ref', 'on');
}"> visibility</span>`,
`<span>Opacity: &emsp;</span><input type="range" id="opacity_control" min="0" max="1" value="0.4" step="0.1">			  
<div class="radio-group">
		<button class="btn btn-selected" type="button" name="annotationType" id="rectangle" autocomplete="off" value="rect" checked onclick="openseadragon_image_annotations.annotationType='rect';$(this).parent().children().removeClass('btn-selected');$(this).addClass('btn-selected');"><span class="material-icons"> crop_5_4 </span></button>
		<button class="btn" type="button" name="annotationType" id="ellipse" autocomplete="off" value="ellipse" onclick="openseadragon_image_annotations.annotationType='ellipse';$(this).parent().children().removeClass('btn-selected');$(this).addClass('btn-selected');"><span class="material-icons"> panorama_fish_eye </span></button>
		<button class="btn" type="button" name="annotationType" id="polygon" autocomplete="off" value="polygon" onclick="openseadragon_image_annotations.annotationType='polygon';$(this).parent().children().removeClass('btn-selected');$(this).addClass('btn-selected');"><span class="material-icons"> share </span></button>		  
</div>
<a id="download_link1" download="my_exported_file.json" href="" hidden>Download as json File</a>
<a id="download_link2" download="my_exported_file.xml" href="" hidden>Download as xml File</a>`, 
`<div id="imageAnnotationToolbarContent">
			<br>
			<div>
			  <input type="text" class="form-control"  style="width:275px; border-top-right-radius: 0;border-bottom-right-radius: 0;" value="Left Click" onchange="openseadragon_image_annotations.leftClickLabel = $(this).val();" title="Default comment for left mouse button." >
			  <input type="color" id="leftClickColor" class="form-control input-lm input-group-button" style="width:45px; height:32px; border-top-left-radius: 0;  border-bottom-left-radius: 0;" name="leftClickColor" value="${openseadragon_image_annotations.objectOptionsLeftClick.fill}" onchange="openseadragon_image_annotations.setColor($(this).val(), 'leftClickColor');">
			</div>
			<div>
			<input type="text" class="form-control" style="width:275px; border-top-right-radius: 0;	border-bottom-right-radius: 0;" value="Right Click" onchange="openseadragon_image_annotations.rightClickLabel = $(this).val();" title="Default comment for right mouse button." >
			  <input type="color" id="rightClickColor" class="form-control input-lm input-group-button" style="width:45px; height:32px;  border-top-left-radius: 0; border-bottom-left-radius: 0;"  height:100%;"name="rightClickColor" value="${openseadragon_image_annotations.objectOptionsRightClick.fill}" onchange="openseadragon_image_annotations.setColor($(this).val(), 'rightClickColor');">
			  </div>
			<br>
			<div style='width:65%;' class='d-inline-block'>
			<span>Automatic tool threshold:</span>
			<input title="What is the threshold under which automatic tool refuses to select." type="range" id="sensitivity_auto_outline" min="0" max="100" value="${openseadragon_image_annotations.alphaSensitivity}" step="1" onchange="openseadragon_image_annotations.setAutoOutlineSensitivity($(this).val());">
			
			</div>
			<div style='width:25%;' class='d-inline-block'>
			<span>Brush:</span><br>	<button class="btn btn-selected" type="button" name="annotationType" id="ellipse" autocomplete="off" value="ellipse"><span class="material-icons"> panorama_fish_eye </span></button><br>
			</div>
			</div>`);

		this.history.init(50);

		$("body").append(`
<div id="help" class="position-fixed" style="z-index:99999; display:none; left: 50%;top: 50%;transform: translate(-50%,-50%);">
<details-dialog class="Box Box--overlay d-flex flex-column anim-fade-in fast" style=" max-width:700px; max-height: 600px;">
    <div class="Box-header">
      <button class="Box-btn-octicon btn-octicon float-right" type="button" aria-label="Close help" onclick="$('#help').css('display', 'none');">
        <svg class="octicon octicon-x" viewBox="0 0 12 16" version="1.1" width="12" height="16" aria-hidden="true"><path fill-rule="evenodd" d="M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z"></path></svg>
      </button>
      <h3 class="Box-title">Annotations help</h3>
    </div>
    <div class="overflow-auto">
      <div class="Box-body overflow-auto">
	  
	  <div class="flash mt-3 flash-error">
	  <span class="octicon octicon-flame material-icons" viewBox="0 0 16 16" width="16" height="16"> error</span>
	  Annotations work only for the original visualisations, edge-based visualisations do not support automatic selection (yet).
	</div>
	<br>
	
      <h4 class="mt-2"><span class="material-icons">brush</span>Brushes</h3>
      <p>You can choose from  <span class="material-icons">crop_5_4</span>rectangle, <span class="material-icons">panorama_fish_eye</span>ellipse or <span class="material-icons">share</span>polygon. </p>
      
      <h4><span class="material-icons"> settings_overscan</span>Click to annotate</h3>
      <p>You can create annotations with both left and right mouse button. Each button has default color and comment you can customize.
      When you click on the canvas, a default object depending on a brush is created: if it is inside a visualised region, it will try to fit the underlying shape. Polygon will fail 
      outside vis regions, other tools create default-sized object.</p>
      <p><b>Automatic tool treshold</b> is the sensitivity of automatic selection: when minimized, the shape will take all surrounding areas. When set high, only the most prominent areas
      will be included.</p>

	  <div class="flash mt-3 flash-error">
	  <span class="octicon octicon-flame material-icons" viewBox="0 0 16 16" width="16" height="16"> error</span>
	  Avoid auto-appending of large areas (mainly large probability tile chunks), the algorithm is still not optimized and the vizualiation would freeze. In that case, close the tab and reopen a new one.
	</div>
      

      <br>
	  
	  <h4 class="mt-2"><span class="material-icons">highlight_alt</span>Alt+Drag, Alt+Click</h4>
        <p>With left alt on a keyboard, you can create custom shapes. Simply hold the left alt key and drag for rectangle/ellipse, or click-place points of a polygon. Once you release alt,
        the polygon will be created. With other shapes, to finish the drag is enough.</p>
      <h4 class="mt-2"><span class="material-icons">flip_to_front </span>Shift + Click</h4>
        <p>You can use left mouse button to append regions to a selected object. With right button, you can <b>remove</b> areas from any annotaion object.</p>
      <h4 class="mt-2"><span class="material-icons">assignment</span>Annotation board</h4>
        <p>You can browse exiting annotation objects there. You can edit a comment by <span class="material-icons">edit</span> modifying the label (do not forget to save <span class="material-icons">save</span>).
            Also, selecting an object will send you to its location and highlight it so that you can orient easily in existing annotaions. </p>
      <h4 class="mt-2"><span class="material-icons"> delete</span>Del to delete</h4>
        <p>Highlighted object will be deleted, when you hit 'delete' key. This works handily with annotation board - click and delete to remove any object.</p>
      <h4 class="mt-2"><span class="material-icons"> history</span>History</h4>
        <p>You can use Ctrl+Z to revert any changes made on object that affect its shape. This does not include manual resizing or movement of rectangles or ellipses. 
		You can use Ctrl+Shift+Z to redo the history (note: if you hit the bottom, you can redo history except the last item. In other words, if you undo 'n' operations, you can redo 'n-1').</p>
      <h4 class="mt-2"><span class="material-icons"> tune</span>Advanced modifications</h4>
        <p>By holding the right alt key, you can manually adjust shapes - move them around, resize them or modify polygon vertices. <b style="color: chocolate;">This mode might be very buggy.</b></p>
      </div>
    </div>
  </details-dialog>
  </div>
`);


		// $("body").append(
		// 	`<div id="input_form" style="display:none">
		// 	<table>
		// 	<tr>
		// 		<td>category</td>
		// 		<td>
		// 		<select id="annotation_group" tabindex="2" name="Group">
		// 			<option value="None" selected>None</option>
		// 			<option value="Carcinoma">Carcinoma</option>
		// 			<option value="Exclude">Exclude</option>
		// 			<option value="Another pathology">Another pathology</option>
		// 		</select>
		// 		</td>
		// 	</tr>
		// 	<tr>
		// 		<td>treshold</td>
		// 		<td id="annotation_threshold">1</td>
		// 	</tr>
		// 	<tr>
		// 		<td colspan="2"><textarea id="annotation_comment" placeholder="Add a comment..." name="text" rows="2" tabindex="3"></textarea></td>
		// 	</tr>
		// 	</table>
		// </div>`);

		//form for object property modification
		$("body").append(`<div id="annotation-cursor" style="border: 2px solid black;border-radius: 50%;position: absolute;transform: translate(-50%, -50%);pointer-events: none;display:none;"></div>`);

		this.cursor.init();
		this.opacity = $("#opacity_control");

		/****************************************************************************************************************
	
												 E V E N T  L I S T E N E R S: FABRIC
	
		*****************************************************************************************************************/



		/*
		mouse:down event listener
		On mousedown:
			- mark isDown as true. On mouse:up, we draw annotations if isDown is true.
			- initialize the correct function based on what the currentAnnotationType is.
			*/
		// this.overlay.fabricCanvas().observe('mouse:down', function(o) {
		// 	//todo prevent clicking both buttons simultaneously, some mode which tells which key is active adn allow that one only
		// 	if (!openseadragon_image_annotations.showAnnotations) return;
		// 	openseadragon_image_annotations.cursor.mouseTime = Date.now();

		// 	if (o.button === 1) fabricHandleLeftClickDown(o);
		// 	else if (o.button === 3) fabricHandleRightClickDown(o);
		// });

		$('.upper-canvas').mousedown(function (event) {
			if (!openseadragon_image_annotations.showAnnotations || PLUGINS.osd.isMouseNavEnabled()) return;
			openseadragon_image_annotations.cursor.mouseTime = Date.now();

			if (event.which === 1) fabricHandleLeftClickDown(event);
			else if (event.which === 3) fabricHandleRightClickDown(event);
		});

		function fabricHandleRightClickDown(o) {
			console.log("fabric right mouse down");
			if (openseadragon_image_annotations.isMouseOSDInteractive()) {
				handleFabricKeyDownInOSDMode(o, false);
			}
		}

		function fabricHandleLeftClickDown(o) {
			console.log("fabric mouse down");

			if (openseadragon_image_annotations.isMouseOSDInteractive()) {
				handleFabricKeyDownInOSDMode(o, true);
			} else {
				handleFabricKeyDownInEditMode(o);
			}
		}

		function handleFabricKeyDownInOSDMode(o, isLeftClick) {
			var pointer = openseadragon_image_annotations.overlay.fabricCanvas().getPointer(o);

			if (o.altKey) {
 
				//todo dirty, just send isLeftClick flag
				openseadragon_image_annotations.currentAnnotationObject = { type: openseadragon_image_annotations.annotationType, isLeftClick: isLeftClick };
				openseadragon_image_annotations.overlay.fabricCanvas().discardActiveObject(); //deselect active if present
				openseadragon_image_annotations.overlay.fabricCanvas().renderAll();

				this.currentAnnotationObjectUpdater = null;
				switch (openseadragon_image_annotations.annotationType) {
					case 'polygon':
						openseadragon_image_annotations.polygon.updateCreate(pointer.x, pointer.y, isLeftClick);
						return; //no mouse motion tracking	 
					case 'rect':
						openseadragon_image_annotations.rectangle.initCreate(pointer.x, pointer.y, isLeftClick);
						break;
					case 'ellipse':
						openseadragon_image_annotations.ellipse.initCreate(pointer.x, pointer.y, isLeftClick);
						break;
					default:
						return; //other types not support, no mouse motion tracking
				}

			} else if (o.shiftKey) { //shift key, let fabric.js mouse track do the job (need disabled OSD navigation)

				let currentObject = openseadragon_image_annotations.overlay.fabricCanvas().getActiveObject();
				if (!currentObject) {

					//create tool-shaped object
					currentObject = openseadragon_image_annotations.polygon.create(openseadragon_image_annotations.modifyTool.getCircleShape(pointer), openseadragon_image_annotations.objectOptions(isLeftClick));
					openseadragon_image_annotations.overlay.fabricCanvas().add(currentObject);
					openseadragon_image_annotations.overlay.fabricCanvas().setActiveObject(currentObject);
					openseadragon_image_annotations.history.push(currentObject);
				}
				openseadragon_image_annotations.currentAnnotationObject = null; //  IMPORTANT!

				openseadragon_image_annotations.modifyTool.init(currentObject, openseadragon_image_annotations.toScreenCoords(pointer.x, pointer.y), 100, isLeftClick);
				openseadragon_image_annotations.modifyTool.update(pointer);
			} else {
				//problem when click on cavas and the browser is not in focus, prevent current selection from removal
				openseadragon_image_annotations.currentAnnotationObject = null; //  IMPORTANT!
			}

			openseadragon_image_annotations.cursor.isDown = true;
		}

		function handleFabricKeyDownInEditMode(o) {
			// openseadragon_image_annotations.cursor.isDown = true;

			// if (!o.target) return;

			// if (o.target && o.target.type == "polygon" && openseadragon_image_annotations.polygon.currentlyEddited != o.target) {
			// 	//edit polygon only if new one selected
			// 	if (openseadragon_image_annotations.polygon.currentlyEddited) {
			// 		//save if switch to other polygon
			// 		openseadragon_image_annotations.polygon.generatePolygon(openseadragon_image_annotations.polygon.pointArray);
			// 	}
			// 	//init another
			// 	console.log("init")
			// 	var polygon = openseadragon_image_annotations.overlay.fabricCanvas().getActiveObject();
			// 	openseadragon_image_annotations.polygon.edit(polygon);
			// 	openseadragon_image_annotations.set_input_form(o.target);
			// 	$("#input_form").show();
			// } else if (o.target.type == "rect" || o.target.type == "ellipse" || o.target.type == "polygon") {
			// 	openseadragon_image_annotations.set_input_form(o.target);
			// 	$("#input_form").show();
			// }

			// openseadragon_image_annotations.cursor.isDown = true;
		}

		/*
			Handle fabric mouse up event
			 - when holding ALT key, OSD is temporarily disabled and this handler fires
			 - when in editing mode, OSD is disabled and this handler fires
		*/
		// this.overlay.fabricCanvas().on('mouse:up', function(o) {
		// 	if (!openseadragon_image_annotations.showAnnotations || !openseadragon_image_annotations.cursor.isDown) return;
		// 	console.log("fabric mouse up")

		// 	openseadragon_image_annotations.cursor.isDown = false;			

		// 	if (o.button === 1) fabricHandleLeftClickUp(o);
		// 	else if (o.button === 3) fabricHandleRightClickUp(o);
		// });

		$('.upper-canvas').mouseup(function (event) {
			if (!openseadragon_image_annotations.showAnnotations || PLUGINS.osd.isMouseNavEnabled()) return;
			//if (openseadragon_image_annotations.isMouseOSDInteractive() && (!event.ctrlKey || !event.altKey || !event.shiftKey)) return;
			openseadragon_image_annotations.cursor.isDown = false;

			console.log("UP");

			if (event.which === 1) fabricHandleLeftClickUp(event);
			else if (event.which === 3) fabricHandleRightClickUp(event);
		});

		function fabricHandleRightClickUp(o) {
			if (openseadragon_image_annotations.isMouseOSDInteractive()) {
				handleFabricKeyUpInOSDMode(o);
			}
		}

		function fabricHandleLeftClickUp(o) {
			if (openseadragon_image_annotations.isMouseOSDInteractive()) {
				handleFabricKeyUpInOSDMode(o);
			} else {
				handleFabricKeyUpInEditMode(o);
			}
		}

		function handleFabricKeyUpInOSDMode(o) {
			openseadragon_image_annotations.cursor.isDown = false;
			PLUGINS.osd.setMouseNavEnabled(true);
			let delta = Date.now() - openseadragon_image_annotations.cursor.mouseTime;

			if (o.altKey) {

				if (!openseadragon_image_annotations.currentAnnotationObject) return;

				if (delta < 100) { // if click too short, user probably did not want to create such object, discard
					//TODO this deletes created elements if wrong event registered (sometimes)
					switch (openseadragon_image_annotations.currentAnnotationObject.type) {
						case 'rect':
						case 'ellipse': //clean
							console.log("REMOVED OBJECT WITHOUT HISTORY");
							openseadragon_image_annotations.overlay.fabricCanvas().remove(openseadragon_image_annotations.currentAnnotationObject);
							return;
						case 'polygon':
						default:
							return;
					}
				}

				switch (openseadragon_image_annotations.currentAnnotationObject.type) {
					case 'rect':
					case 'ellipse':
						//openseadragon_image_annotations.overlay.fabricCanvas().remove(openseadragon_image_annotations.currentAnnotationObject)
						//openseadragon_image_annotations.overlay.fabricCanvas().add(openseadragon_image_annotations.currentAnnotationObject);
						openseadragon_image_annotations.history.push(openseadragon_image_annotations.currentAnnotationObject);
						openseadragon_image_annotations.overlay.fabricCanvas().renderAll();
						openseadragon_image_annotations.overlay.fabricCanvas().setActiveObject(openseadragon_image_annotations.currentAnnotationObject);
						// openseadragon_image_annotations.set_input_form(openseadragon_image_annotations.currentAnnotationObject);
						// $("#input_form").show();
						openseadragon_image_annotations.currentAnnotationObject = "";
						break;
					case 'polygon': //no action, polygon is being created by click 
					default:
						break;
				}

			} else if (o.shiftKey) {
				let result = openseadragon_image_annotations.modifyTool.finish();
				if (result) openseadragon_image_annotations.overlay.fabricCanvas().setActiveObject(result);
			}
		}

		function handleFabricKeyUpInEditMode(isLeftClick) {
			//useful... or delete?
		}


		/*
			Update object when user hodls ALT and moving with mouse (openseadragon_image_annotations.isMouseOSDInteractive() == true)
		*/
		this.overlay.fabricCanvas().on('mouse:move', function (o) {
			if (!openseadragon_image_annotations.showAnnotations) return;

			var pointer = openseadragon_image_annotations.overlay.fabricCanvas().getPointer(o.e);

			if (!openseadragon_image_annotations.cursor.isDown) return;

			if (openseadragon_image_annotations.key_code === "AltLeft") {
				if (openseadragon_image_annotations.isMouseOSDInteractive() && openseadragon_image_annotations.currentAnnotationObjectUpdater) {

					openseadragon_image_annotations.currentAnnotationObjectUpdater.updateCreate(pointer.x, pointer.y);
					openseadragon_image_annotations.overlay.fabricCanvas().renderAll();
				}
			} else if (openseadragon_image_annotations.key_code === "ShiftLeft") {
				openseadragon_image_annotations.modifyTool.update(pointer);
			} else if (openseadragon_image_annotations.key_code === "AltRight") {
				if (openseadragon_image_annotations.isMouseOSDInteractive() && !openseadragon_image_annotations.currentAnnotationObjectUpdater) {

					openseadragon_image_annotations.currentAnnotationObjectUpdater.updateCreate(pointer.x, pointer.y);
					openseadragon_image_annotations.overlay.fabricCanvas().renderAll();
				}
			}
		});


		/*
		object:moving event listener
		if object that is move is cirlce (on of the polygon points),
		start editPolygon function which will update point coordinates
				*/
		this.overlay.fabricCanvas().on('object:moving', function (o) {
			if (!openseadragon_image_annotations.showAnnotations) return;

			var objType = o.target.get('type');
			if (objType == "_polygon.controls.circle") {
				openseadragon_image_annotations.polygon.updateEdit(o.target);
				openseadragon_image_annotations.overlay.fabricCanvas().renderAll();
			}
		});

		/*
		 mouse:over event listener
		 if mouse is over polygon or rectangle and polygon is not being edited
		 and no other annotation is selected, show input form
				 */
		// this.overlay.fabricCanvas().on('mouse:over', function (o) {
		// 	if (!openseadragon_image_annotations.showAnnotations) return;

		// 	if (!openseadragon_image_annotations.isMouseOSDInteractive()) {
		// 		openseadragon_image_annotations.cursor.isOverObject = true;
		// 		console.log("fabric object over")

		// 		if (o.target && (o.target.type == "rect" || o.target.type == "polygon") && !(openseadragon_image_annotations.polygon.polygonBeingCreated) && !(openseadragon_image_annotations.overlay.fabricCanvas().getActiveObject())) {
		// 			var annotation = o.target;
		// 			openseadragon_image_annotations.set_input_form(annotation);
		// 			$("#input_form").show();
		// 		};
		// 	}
		// });

		/*
		 mouse:out event listener
		 when mouse leaves the annotation hide imput form
		 (only if anootation is not selected in edit mode !, then input form should stay so it can be edited,
	   it will be hidden after edit mode is cancelled of annotation id deselected)
				 */
		// this.overlay.fabricCanvas().on('mouse:out', function (o) {
		// 	if (!openseadragon_image_annotations.showAnnotations) return;

		// 	openseadragon_image_annotations.cursor.isOverObject = false;
		// 	console.log("fabric object out")

		// 	if (!(openseadragon_image_annotations.isMouseOSDInteractive() && openseadragon_image_annotations.overlay.fabricCanvas().getActiveObject())) {
		// 		$("#input_form").hide();
		// 	};
		// });

		/*
			selection:cleared
			 hide input form when annotaion is deselected
					*/

		this.overlay.fabricCanvas().on('selection:cleared', function (e) {
			if (!openseadragon_image_annotations.showAnnotations || openseadragon_image_annotations.isMouseOSDInteractive()) return;
			//$("#input_form").hide();
		});

		// this.overlay.fabricCanvas().on('before:selection:cleared', function(e) {
		// 	console.log("DELSELETCL", e);
		// 	if(e && e.target){
		// 		//e.target.set('shadow',null);
		// 		e.target.hasControls = !openseadragon_image_annotations.isMouseOSDInteractive();
		// 	} 
		// });

		this.overlay.fabricCanvas().on('object:selected', function (e) {
			if (e && e.target) {
				//e.target.set('shadow', { blur: 30, offsetX: 0, offsetY: 0});
				openseadragon_image_annotations.history.highlight(e.target);
				e.target.hasControls = !openseadragon_image_annotations.isMouseOSDInteractive();
			}
		});


		/****************************************************************************************************************

											 E V E N T  L I S T E N E R S: OSD (clicks without alt or shift)
						OpenSeadragon listeners for adding annotation in navigation mode, can
						temporarily disable the navigation when a key is held to allow user-driven
						object creation, default is automatic creation

		*****************************************************************************************************************/

		PLUGINS.osd.addHandler("canvas-press", function (e) {
			if (!openseadragon_image_annotations.showAnnotations) return;
			openseadragon_image_annotations.cursor.mouseTime = Date.now();

			//if clicked on object, highlight it
			openseadragon_image_annotations.currentAnnotationObject = openseadragon_image_annotations.overlay.fabricCanvas().findTarget(e.originalEvent);
			if (openseadragon_image_annotations.currentAnnotationObject) {
				openseadragon_image_annotations.overlay.fabricCanvas().setActiveObject(openseadragon_image_annotations.currentAnnotationObject);
				openseadragon_image_annotations.cursor.mouseTime = 0;
				return;
			}

			//else create automated version of openseadragon_image_annotations.annotationType object
			openseadragon_image_annotations.currentAnnotationObject = { type: openseadragon_image_annotations.annotationType, isLeftClick: true };
		});

		PLUGINS.osd.addHandler("canvas-release", function (e) {
			if (!openseadragon_image_annotations.showAnnotations) return;

			let delta = Date.now() - openseadragon_image_annotations.cursor.mouseTime;
			if (delta > 100) return; // just navigate if click longer than 100ms

			let isLeftClick = true;
			switch (e.originalEvent.which) {
				case 1: break;
				case 3: isLeftClick = false;
					break;
				default: return;
			}

			switch (openseadragon_image_annotations.currentAnnotationObject.type) {
				case 'rect':
					openseadragon_image_annotations.createApproxRectangle(e.position, isLeftClick);
					break;
				case 'ellipse':
					openseadragon_image_annotations.createApproxEllipse(e.position, isLeftClick);
					break;
				case 'polygon':
					openseadragon_image_annotations.createRegionGrowingOutline(e.position);
					break;
				default:
					break;
			}
		});

		PLUGINS.osd.addHandler("canvas-nonprimary-press", function (e) {
			if (!openseadragon_image_annotations.showAnnotations) return;

			if (e.button != 2 || e.originalEvent.shiftKey || e.originalEvent.altKey) return; //plain right click only
			openseadragon_image_annotations.cursor.mouseTime = Date.now();
			openseadragon_image_annotations.currentAnnotationObject = { type: openseadragon_image_annotations.annotationType, isLeftClick: false };
		});

		PLUGINS.osd.addHandler("canvas-nonprimary-release", function (e) {
			if (!openseadragon_image_annotations.showAnnotations) return;

			let delta = Date.now() - openseadragon_image_annotations.cursor.mouseTime;
			if (delta > 100) return; // just navigate if click longer than 100ms

			let isLeftClick = true;
			switch (e.originalEvent.which) {
				case 1: break;
				case 3: isLeftClick = false;
					break;
				default: return;
			}

			switch (openseadragon_image_annotations.currentAnnotationObject.type) {
				case 'rect':
					openseadragon_image_annotations.createApproxRectangle(e.position, isLeftClick);
					break;
				case 'ellipse':
					openseadragon_image_annotations.createApproxEllipse(e.position, isLeftClick);
					break;
				case 'polygon':
					openseadragon_image_annotations.createRegionGrowingOutline(e.position);
					break;
				default:
					break;
			}
		});

		/****************************************************************************************************************

											 E V E N T  L I S T E N E R S: GENERAL

		*****************************************************************************************************************/



		$(PLUGINS.osd.element).on('contextmenu', function (event) {
			event.preventDefault();
		});

		document.addEventListener('keydown', (e) => {
			if (!openseadragon_image_annotations.showAnnotations || !openseadragon_image_annotations.isMouseOSDInteractive()) return;
			if (e.code === "AltLeft") {
				PLUGINS.osd.setMouseNavEnabled(false);
			} else if (e.code === "ShiftLeft") {
				PLUGINS.osd.setMouseNavEnabled(false);
				openseadragon_image_annotations.overlay.fabricCanvas().defaultCursor = "crosshair";
				openseadragon_image_annotations.overlay.fabricCanvas().hoverCursor = "crosshair";
				//todo value of radius from user
				// openseadragon_image_annotations.modifyTool.setRadius(100); //so that cursor radius that is being taken from here will be correct before midify tool init

				openseadragon_image_annotations.cursor.show();
			} else if (e.code === "AltRight") {
				openseadragon_image_annotations.setMouseOSDInteractive(false);
			}
			openseadragon_image_annotations.key_code = e.code;

		});

		document.addEventListener('keyup', (e) => {

			openseadragon_image_annotations.key_code = null;
			if (!openseadragon_image_annotations.showAnnotations) return;

			if (!openseadragon_image_annotations.isMouseOSDInteractive()) {
				if (e.code === "AltRight") {
					openseadragon_image_annotations.setMouseOSDInteractive(true);
					let active = this.overlay.fabricCanvas().getActiveObject();
					if (active) active.hasControls = false;
				}
			} else {
				if (e.code === "Delete") {
					openseadragon_image_annotations.removeActiveObject();
					openseadragon_image_annotations.currentAnnotationObject = null;
				}

				//todo delete valid in both modes?
				//if (!openseadragon_image_annotations.isMouseOSDInteractive()) return;

				if (e.ctrlKey && e.code === "KeyY") {
					if (e.shiftKey) openseadragon_image_annotations.history.redo();
					else openseadragon_image_annotations.history.back();
				} else if (e.code === "AltLeft") {
					if (!openseadragon_image_annotations.cursor.isDown) {
						//ALTHOUGH mouse nav enabled in click up in FABRIC, not recognized if alt key down when releasing -- do it here
						PLUGINS.osd.setMouseNavEnabled(true);
					}

					if (this.polygon.polygonBeingCreated) {
						this.polygon.finish();
						PLUGINS.osd.setMouseNavEnabled(true);
					}
				} else if (e.code === "ShiftLeft") {
					if (!openseadragon_image_annotations.cursor.isDown) {
						//ALTHOUGH mouse nav enabled in click up in FABRIC, not recognized if alt key down when releasing -- do it here

						openseadragon_image_annotations.overlay.fabricCanvas().defaultCursor = "crosshair";
						openseadragon_image_annotations.overlay.fabricCanvas().hoverCursor = "pointer";
						PLUGINS.osd.setMouseNavEnabled(true);
						openseadragon_image_annotations.cursor.hide();
					}
				}
			}


		});



		// listen for annotation send button
		$('#sendAnnotation').click(function (event) {
			console.log("sending");
			//generate ASAPXML annotations
			var doc = generate_ASAPxml(openseadragon_image_annotations.overlay.fabricCanvas()._objects);
			var xml_text = new XMLSerializer().serializeToString(doc);

			// get file name from probabilities layer (axperiment:slide)
			var probabs_url_array = PLUGINS.osd.tileSources[2].split("=")[1].split("/");
			var slide = probabs_url_array.pop().split(".")[0].slice(0, -4);
			var experiment = probabs_url_array.pop();
			var file_name = [experiment, slide].join(":");

			//prepare data to be send, (file_name and xml with annotations)
			var send_data = { "name": file_name, "xml": xml_text };
			console.log(send_data);

			$.ajaxSetup({
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				}
			});
			//send data to url
			$.post('http://ip-78-128-251-178.flt.cloud.muni.cz:5050/occlusion',  // url
				JSON.stringify(send_data), // data to be submit
				function (data, status, xhr) {   // success callback function
					openseadragon_image_annotations.messenger.show('status: ' + status + ', data: ' + data.responseData, 8000, openseadragon_image_annotations.messenger.MSG_INFO);
				});
		});


		//todo decide what format to use, discard the other one
		// download annotation as default json file and generated ASAP xml file
		$('#downloadAnnotation').click(function (event) {
			//json

			//TODO add oteher attributes for export to preserve funkcionality (border width, etc)
			var text = this.getJSONContent();
			var json_data = new Blob([text], { type: 'text/plain' });
			var url1 = window.URL.createObjectURL(json_data);
			document.getElementById('download_link1').href = url1;
			document.getElementById('download_link1').click();
			//asap xml
			var doc = generate_ASAPxml(openseadragon_image_annotations.overlay.fabricCanvas()._objects);
			var xml_text = new XMLSerializer().serializeToString(doc);
			var xml_data = new Blob([xml_text], { type: 'text/plain' });
			var url2 = window.URL.createObjectURL(xml_data);
			document.getElementById('download_link2').href = url2;
			document.getElementById('download_link2').click();
		});

		// create ASAP xml form with neccessary tags
		//todo async? 
		function generate_ASAPxml(canvas_objects) {
			// first, create xml dom
			doc = document.implementation.createDocument("", "", null);
			ASAP_annot = doc.createElement("ASAP_Annotations");
			xml_annotations = doc.createElement("Annotations");
			ASAP_annot.appendChild(xml_annotations);
			doc.appendChild(ASAP_annot);

			// for each object (annotation) create new annotation element with coresponding coordinates
			for (var i = 0; i < canvas_objects.length; i++) {
				var obj = canvas_objects[i];
				if (obj.type == "_polygon.controls.circle") {
					continue
				};
				var xml_annotation = doc.createElement("Annotation");
				xml_annotation.setAttribute("Name", "Annotation " + i);
				if (obj.type == "rect") {
					xml_annotation.setAttribute("Type", "Rectangle");
					var coordinates = generate_rect_ASAP_coord(obj);
				}
				if (obj.type == "polygon") {
					xml_annotation.setAttribute("Type", "Polygon");
					var coordinates = generate_polygon_ASAP_coord(obj);
				}
				xml_annotation.setAttribute("PartOfGroup", obj.a_group);
				//xml_annotation.setAttribute("Color", "#F4FA58");
				xml_annotation.setAttribute("Color", obj.fill);

				//get coordinates in ASAP format
				var xml_coordinates = doc.createElement("Coordinates");


				// create new coordinate element for each coordinate
				for (var j = 0; j < coordinates.length; j++) {
					var xml_coordinate = doc.createElement("Coordinate");
					xml_coordinate.setAttribute("Order", j);
					xml_coordinate.setAttribute("X", coordinates[j][0]);
					xml_coordinate.setAttribute("Y", coordinates[j][1]);
					xml_coordinates.appendChild(xml_coordinate);
				}
				// append coordinates to annotation
				xml_annotation.appendChild(xml_coordinates);
				// append whole annotation to annotations
				xml_annotations.appendChild(xml_annotation);
			}
			return doc
		};

		function generate_rect_ASAP_coord(rect) {
			// calculate 4 coordinates of square annotation
			var coordinates = [];
			coordinates[0] = [rect.left + rect.width, rect.top];
			coordinates[1] = [rect.left, rect.top];
			coordinates[2] = [rect.left, rect.top + rect.height];
			coordinates[3] = [rect.left + rect.width, rect.top + rect.height];
			return coordinates;
		};

		function generate_polygon_ASAP_coord(polygon) {
			// calculate  coordinates of plygon annotation
			var coordinates = [];
			for (var j = 0; j < polygon.points.length; j++) {
				coordinates[j] = [polygon.points[j].x, polygon.points[j].y]
			};
			return coordinates;
		};


		// listen for changes in opacity slider and change opacity for each annotation
		this.opacity.on("input", function () {
			var opacity = $(this).val();
			openseadragon_image_annotations.overlay.fabricCanvas().forEachObject(function (obj) {
				obj.opacity = opacity;
			});

			openseadragon_image_annotations.overlay.fabricCanvas().renderAll();

		});

		/*
  listener form object:modified
			-recalcute coordinates for annotations
		*/
		this.overlay.fabricCanvas().on("object:modified", function (o) {
			if (!openseadragon_image_annotations.showAnnotations || openseadragon_image_annotations.isMouseOSDInteractive()) return;

			//todofix...
			var canvas = openseadragon_image_annotations.overlay.fabricCanvas();
			if (o.target.type == "rect") {
				// set correct coordinates when object is scaling
				o.target.width *= o.target.scaleX;
				o.target.height *= o.target.scaleY;
				o.target.scaleX = 1;
				o.target.scaleY = 1;
				//openseadragon_image_annotations.set_input_form(o.target);
				//$("#input_form").show();

			};

			// if polygon is being modified (size and position, not separate points)
			if (o.target.type != "polygon" || openseadragon_image_annotations.polygon.currentlyEddited) { return };
			var original_polygon = o.target;
			var matrix = original_polygon.calcTransformMatrix();
			var transformedPoints = original_polygon.get("points")
				.map(function (p) {
					return new fabric.Point(
						p.x - original_polygon.pathOffset.x,
						p.y - original_polygon.pathOffset.y);
				})
				.map(function (p) {
					return fabric.util.transformPoint(p, matrix);
				});

			// create new polygon with updated coordinates
			var modified_polygon = this.polygon.create(transformedPoints, original_polygon.isLeftClick);
			// remove orignal polygon and replace it with modified one
			canvas.remove(original_polygon);
			canvas.add(modified_polygon).renderAll();
			// TODO keep HISTORY in edit mode?
			// openseadragon_image_annotations.history.push(modified_polygon, original_polygon);
			// openseadragon_image_annotations.history.highlight(modified_polygon)


			//todo what about setting active control points correctly? maybe not possible with ctrl, so default is not show
			canvas.setActiveObject(modified_polygon);
			//openseadragon_image_annotations.set_input_form(modified_polygon);
			//$("#input_form").show();
		});

		// update annotation group (from input form)
		$("#annotation_group").on("change", function () {
			var annotation = openseadragon_image_annotations.overlay.fabricCanvas().getActiveObject();
			annotation.set({ a_group: $(this).val() });

		});
		//update annotation comment (from input form)
		$("#annotation_comment").on("input", function () {
			var annotation = openseadragon_image_annotations.overlay.fabricCanvas().getActiveObject();
			if (annotation) {
				annotation.set({ comment: $(this).val() })
			};
			openseadragon_image_annotations.history._updateBoardText(annotation, annotation.comment);
		});

		// delete all annotation
		$('#deleteAll').click(function () {
			// if polygon was mid-drawing resets all parameters
			openseadragon_image_annotations.polygon.polygonBeingCreated = false;
			openseadragon_image_annotations.deleteAllAnnotations();
		});
	}, // end of initialize

	getJSONContent: function () {
		return JSON.stringify(openseadragon_image_annotations.overlay.fabricCanvas().toObject(['comment', 'a_group', 'threshold']));
	},


	/****************************************************************************************************************

									S E T T E R S, GETTERS

	*****************************************************************************************************************/

	// set color for future annotation and change color of selected one
	setColor: function (color, name = "currentAnnotationColor") {
		openseadragon_image_annotations[name] = color; //convert to hex

		//TODO now not possible to change already created color, do we want to have that possibiltiy or not?
		// var annotation = openseadragon_image_annotations.overlay.fabricCanvas().getActiveObject();
		// if (annotation) {
		// 	annotation.set({ fill: openseadragon_image_annotations[name] });
		// 	openseadragon_image_annotations.overlay.fabricCanvas().renderAll();
		// }
	},

	// 0 --> no sensitivity  100 --> most sensitive
	setAutoOutlineSensitivity: function (sensitivity) {
		//we map to alpha interval 20 (below no visible) to 200 (only the most opaque elements) --> interval of 180 length
		this.alphaSensitivity = Math.round(180 * (sensitivity / 100) + 20);
	},

	setMouseOSDInteractive: function (isOSDInteractive) {
		if (this.mouseOSDInteractive == isOSDInteractive) return;

		if (isOSDInteractive) {
			//this.setFabricCanvasInteractivity(true);
			//this.deselectFabricObjects();
			PLUGINS.osd.setMouseNavEnabled(true);
			//$("#input_form").hide();
			this.overlay.fabricCanvas().defaultCursor = "crosshair";
			this.overlay.fabricCanvas().hoverCursor = "pointer";

			if (this.polygon.currentlyEddited) {
				//save if eddited
				this.polygon.finish();
			}

			let active = this.overlay.fabricCanvas().getActiveObject();
			if (active) {
				active.hasControls = false;
			}

		} else {
			//this.setFabricCanvasInteractivity(true);
			PLUGINS.osd.setMouseNavEnabled(false);
			this.overlay.fabricCanvas().defaultCursor = "auto";
			this.overlay.fabricCanvas().hoverCursor = "move";

			let active = this.overlay.fabricCanvas().getActiveObject();
			if (active) {
				active.hasControls = true;
				if (active.type == "polygon") this.polygon.initEdit(active);
				//this.set_input_form(active);
				//$("#input_form").show();
			}
		}
		this.overlay.fabricCanvas().renderAll();
		this.mouseOSDInteractive = isOSDInteractive;
	},

	isMouseOSDInteractive: function () {
		return this.mouseOSDInteractive;
	},

	removeActiveObject: function () {
		let toRemove = this.overlay.fabricCanvas().getActiveObject();
		if (toRemove) {
			if (toRemove.type === "rect" || toRemove.type === "polygon" || toRemove.type === "ellipse") {
				this.overlay.fabricCanvas().remove(toRemove);
				this.history.push(null, toRemove);
				this.overlay.fabricCanvas().renderAll();
			} else if (toRemove) {
				this.overlay.fabricCanvas().remove(toRemove);

			}
		}
	},

	/****************************************************************************************************************

									A N N O T A T I O N S (Automatic)

	*****************************************************************************************************************/

	//todo generic function that creates object? kinda copy paste
	createApproxEllipse: function (eventPosition, isLeftClick) {
		let bounds = this._getSimpleApproxObjectBounds(eventPosition);
		this.currentAnnotationObject = this.ellipse.create(bounds.left.x, bounds.top.y, (bounds.right.x - bounds.left.x) / 2, (bounds.bottom.y - bounds.top.y) / 2, openseadragon_image_annotations.objectOptions(isLeftClick));
		this.currentAnnotationObjectUpdater = this.ellipse;
		this.overlay.fabricCanvas().add(this.currentAnnotationObject);
		this.history.push(this.currentAnnotationObject);
		this.overlay.fabricCanvas().setActiveObject(this.currentAnnotationObject);
		this.overlay.fabricCanvas().renderAll();
	},

	createApproxRectangle: function (eventPosition, isLeftClick) {
		let bounds = this._getSimpleApproxObjectBounds(eventPosition);
		this.currentAnnotationObject = this.rectangle.create(bounds.left.x, bounds.top.y, bounds.right.x - bounds.left.x, bounds.bottom.y - bounds.top.y, openseadragon_image_annotations.objectOptions(isLeftClick));
		this.currentAnnotationObjectUpdater = this.rectangle;
		this.overlay.fabricCanvas().add(this.currentAnnotationObject);
		this.history.push(this.currentAnnotationObject);
		this.overlay.fabricCanvas().setActiveObject(this.currentAnnotationObject);
		this.overlay.fabricCanvas().renderAll();
	},

	createOutline: async function (eventPosition) {
		console.log("called outline");

		var viewportPos = PLUGINS.osd.viewport.pointFromPixel(eventPosition);
		//var imagePoint = PLUGINS.dataLayer.viewportToImageCoordinates(viewportPos);
		var originPoint = PLUGINS.osd.viewport.pixelFromPoint(viewportPos);
		this.changeTile(viewportPos);

		//todo unused, maybe round origin point...?
		// eventPosition.x = Math.round(eventPosition.x);
		// eventPosition.y = Math.round(eventPosition.y);


		let points = new Set();
		this.comparator = function (pix) {
			return (pix[3] > this.alphaSensitivity && (pix[0] > 200 || pix[1] > 200));
		}

		var x = originPoint.x;  // current x position
		var y = originPoint.y;  // current y position
		var direction = "UP"; // current direction of outline

		let origPixel = this.getPixelData(eventPosition);
		if (!this.comparator(origPixel)) {
			openseadragon_image_annotations.messenger.show("Outside a region - decrease the sensitivity.", openseadragon_image_annotations.messenger.MSG_INFO);
			return
		};

		if (origPixel[0] > 200) {
			this.comparator = function (pix) {
				return pix[3] > this.alphaSensitivity && pix[0] > 200;
			}
		} else {
			this.comparator = function (pix) {
				return pix[3] > this.alphaSensitivity && pix[1] > 200;
			}
		}

		//$("#osd").append(`<span style="position:absolute; top:${y}px; left:${x}px; width:5px;height:5px; background:blue;" class="to-delete"></span>`);

		while (this.getAreaStamp(x, y) == 15) {
			x += 2; //all neightbours inside, skip by two
		}
		x -= 2;

		$("#osd").append(`<span style="position:absolute; top:${y}px; left:${x}px; width:5px;height:5px; background:blue;" class="to-delete"></span>`);

		var first_point = new OpenSeadragon.Point(x, y);

		//indexing instead of switch
		var handlers = [
			// 0 - all neighbours outside, invalid
			function () { console.error("Fell out of region.") },

			// 1 - only TopLeft pixel inside
			function () {
				if (direction == "DOWN") {
					direction = "LEFT";
				} else if (direction == "RIGHT") {
					direction = "UP";
				} else { console.log("INVALID DIRECTION 1)"); return; }
				points.add(openseadragon_image_annotations.toGlobalPointXY(x, y)); //changed direction
			},

			// 2 - only BottomLeft pixel inside
			function () {
				if (direction == "UP") {
					direction = "LEFT";
				} else if (direction == "RIGHT") {
					direction = "DOWN";
				} else { console.log("INVALID DIRECTION 2)"); return; }
				points.add(openseadragon_image_annotations.toGlobalPointXY(x, y)); //changed direction
			},

			// 3 - TopLeft & BottomLeft pixel inside
			function () {
				if (direction != "UP" && direction != "DOWN") { console.log("INVALID DIRECTION 3)"); return; }
			},

			// 4 - only BottomRight pixel inside
			function () {
				if (direction == "UP") {
					direction = "RIGHT";
				} else if (direction == "LEFT") {
					direction = "DOWN";
				} else { console.log("INVALID DIRECTION 4)"); return; }
				points.add(openseadragon_image_annotations.toGlobalPointXY(x, y)); //changed direction
			},

			// 5 - TopLeft & BottomRight pixel inside, one of them does not belong to the area
			function () {
				if (direction == "UP") {
					direction = "RIGHT";
				} else if (direction == "LEFT") {
					direction = "DOWN";
				} else if (direction == "RIGHT") {
					direction = "UP";
				} else { direction = "LEFT"; }
				points.add(openseadragon_image_annotations.toGlobalPointXY(x, y)); //changed direction
			},

			// 6 - BottomLeft & BottomRight pixel inside, one of them does not belong to the area
			function () {
				if (direction != "LEFT" && direction != "RIGHT") { console.log("INVALID DIRECTION 6)"); return; }
			},

			// 7 - TopLeft & BottomLeft & BottomRight  pixel inside, same case as TopRight only
			() => handlers[8](),

			// 8 - TopRight only
			function () {
				if (direction == "DOWN") {
					direction = "RIGHT";
				} else if (direction == "LEFT") {
					direction = "UP";
				} else { console.log("INVALID DIRECTION 8)"); return; }
				points.add(openseadragon_image_annotations.toGlobalPointXY(x, y)); //changed direction
			},

			// 9 - TopLeft & TopRight 
			function () {
				if (direction != "LEFT" && direction != "RIGHT") { console.log("INVALID DIRECTION 6)"); return; }
			},

			// 10 - BottomLeft & TopRight 
			function () {
				if (direction == "UP") {
					direction = "LEFT";
				} else if (direction == "LEFT") {
					direction = "UP";
				} else if (direction == "RIGHT") {
					direction = "DOWN";
				} else { direction = "RIGHT"; }
				points.add(openseadragon_image_annotations.toGlobalPointXY(x, y)); //changed direction
			},

			// 11 - BottomLeft & TopRight & TopLeft --> case 4)
			() => handlers[4](),

			// 12 - TopRight & BottomRight 
			function () {
				if (direction != "TOP" && direction != "DOWN") { console.log("INVALID DIRECTION 12)"); return; }
			},

			// 13 - TopRight & BottomRight & TopLeft
			() => handlers[2](),

			// 14 - TopRight & BottomRight & BottomLeft
			() => handlers[1](),

			// 15 - ALL inside
			function () { console.error("Fell out of region."); }
		];

		surroundingInspector = function (x, y, maxDist) {
			for (var i = 1; i <= maxDist; i++) {
				$("#osd").append(`<span style="position:absolute; top:${y + i}px; left:${x + i}px; width:5px;height:5px; background:red;" class="to-delete"></span>`);

				if (openseadragon_image_annotations.isValidPixel(new OpenSeadragon.Point(x + i, y)) > 0) return [x + i, y + i];
				$("#osd").append(`<span style="position:absolute; top:${y - i}px; left:${x + i}px; width:5px;height:5px; background:red;" class="to-delete"></span>`);

				if (openseadragon_image_annotations.isValidPixel(new OpenSeadragon.Point(x, y + i)) > 0) return [x + i, y - i];
				$("#osd").append(`<span style="position:absolute; top:${y + i}px; left:${x - i}px; width:5px;height:5px; background:red;" class="to-delete"></span>`);

				if (openseadragon_image_annotations.isValidPixel(new OpenSeadragon.Point(x - i, y)) > 0) return [x - i, y + i];
				$("#osd").append(`<span style="position:absolute; top:${y - i}px; left:${x - i}px; width:5px;height:5px; background:red;" class="to-delete"></span>`);

				if (openseadragon_image_annotations.isValidPixel(new OpenSeadragon.Point(x, y + i)) > 0) return [x - i, y - i];

			}
			return null;
		};

		let maxLevel = PLUGINS.dataLayer.source.maxLevel;
		let level = this.currentTile.level;
		let maxSpeed = 24;
		let speed = Math.round(maxSpeed / Math.max(1, 2 * (maxLevel - level)));

		var counter = 0;
		while ((Math.abs(first_point.x - x) > 2 || Math.abs(first_point.y - y) > 2) || counter < 20) {
			let mark = this.getAreaStamp(x, y);
			if (mark == 0 || mark == 15) {
				let findClosest = surroundingInspector(x, y, 2 * speed);
				console.log("CLOSEST", findClosest);
				if (findClosest) {
					x = findClosest[0];
					y = findClosest[1];
					//points.add(this.toGlobalPointXY(x, y));
					console.log("continue");
					continue;
				} else {
					this.messenger.show("Failed to create outline - no close point.", 2000, this.messenger.MSG_ERR);
					return;
				}
			}

			handlers[mark]();

			//todo instead of UP/LEFT etc. set directly
			switch (direction) {
				case 'UP': y--; break;
				case 'LEFT': x--; break;
				case 'RIGHT': x++; break;
				case 'DOWN': y++; break;
				default: console.error("Invalid direction");
			}
			counter++;

			$("#osd").append(`<span style="position:absolute; top:${y}px; left:${x}px; width:5px;height:5px; background:blue;" class="to-delete"></span>`);

			if (counter > 5000) {
				this.messenger.show("Failed to create outline", 1500, this.messenger.MSG_ERR);
				$(".to-delete").remove();

				return;
			}

			if (counter % 100 == 0) { await sleep(200); }
		}

		//todo hardcoded true, this func probably wont survive anyway
		this.currentAnnotationObject = this.polygon.create(Array.from(points), this.objectOptions(true));
		this.overlay.fabricCanvas().add(this.currentAnnotationObject);
		this.history.push(this.currentAnnotationObject);
		this.overlay.fabricCanvas().setActiveObject(this.currentAnnotationObject);
		this.overlay.fabricCanvas().renderAll();

		$(".to-delete").remove();
	},

	createRegionGrowingOutline: function (eventPosition) {

		var viewportPos = PLUGINS.osd.viewport.pointFromPixel(eventPosition);
		var originPoint = PLUGINS.osd.viewport.pixelFromPoint(viewportPos);
		this.changeTile(viewportPos);

		let points = [];
		this.comparator = function (pix) {
			return (pix[3] > this.alphaSensitivity && (pix[0] > 200 || pix[1] > 200));
		}

		var x = originPoint.x;
		var y = originPoint.y;

		let origPixel = this.getPixelData(eventPosition);
		if (!this.comparator(origPixel)) {
			this.messenger.show("Outside a region - decrease sensitivity to select.", 2000, this.messenger.MSG_INFO);
			return
		};

		if (origPixel[0] > 200) {
			this.comparator = function (pix) {
				return pix[3] > this.alphaSensitivity && pix[0] > 200;
			}
		} else {
			this.comparator = function (pix) {
				return pix[3] > this.alphaSensitivity && pix[1] > 200;
			}
		}
		//speed based on ZOOM level (detailed tiles can go with rougher step)
		let maxLevel = PLUGINS.dataLayer.source.maxLevel;
		let level = this.currentTile.level;
		let maxSpeed = 24;
		let speed = Math.round(maxSpeed / Math.max(1, 2 * (maxLevel - level)));

		//	After each step approximate max distance and abort if too small

		//todo same points evaluated multiple times seems to be more stable, BUT ON LARGE CANVAS!!!...

		var maxX = 0, maxY = 0;
		this._growRegionInDirections(x - 1, y, [-1, 0], [[0, -1], [0, 1]], points, speed, this.isValidPixel.bind(this));
		maxX = Math.max(maxX, Math.abs(x - points[points.length - 1].x));
		maxY = Math.max(maxY, Math.abs(y - points[points.length - 1].y));
		this._growRegionInDirections(x + 1, y, [1, 0], [[0, -1], [0, 1]], points, speed, this.isValidPixel.bind(this));
		maxX = Math.max(maxX, Math.abs(x - points[points.length - 1].x));
		maxY = Math.max(maxY, Math.abs(y - points[points.length - 1].y));
		this._growRegionInDirections(x, y + 1, [0, -1], [[-1, 0], [1, 0]], points, speed, this.isValidPixel.bind(this));
		maxX = Math.max(maxX, Math.abs(x - points[points.length - 1].x));
		maxY = Math.max(maxY, Math.abs(y - points[points.length - 1].y));
		this._growRegionInDirections(x, y - 1, [0, 1], [[-1, 0], [1, 0]], points, speed, this.isValidPixel.bind(this));
		maxX = Math.max(maxX, Math.abs(x - points[points.length - 1].x));
		maxY = Math.max(maxY, Math.abs(y - points[points.length - 1].y));

		if (maxX < 10 || maxY < 10) {
			this.messenger.show("Failed to create region.", 3000, this.messenger.MSG_WARN);
			return;
		}

		points = hull(points, 2 * speed);
		let p1 = points[0]; p2 = points[1];
		let result = [this.toGlobalPointXY(p1[0], p1[1])];

		for (var i = 2; i < points.length; i++) {
			//three consecutive points on a line, discard
			if ((Math.abs(p1[0] - p2[0]) < 2 && Math.abs(points[i][0] - p2[0]) < 2)
				|| (Math.abs(p1[1] - p2[1]) < 2 && Math.abs(points[i][1] - p2[1]) < 2)) {
				p2 = points[i];
				continue;
			}

			p1 = p2;
			p2 = points[i];
			result.push(this.toGlobalPointXY(p1[0], p1[1]));
		}

		this.currentAnnotationObject = this.polygon.create(result, this.objectOptions(this.currentAnnotationObject ? this.currentAnnotationObject.isLeftClick : true));
		this.overlay.fabricCanvas().add(this.currentAnnotationObject);

		this.history.push(this.currentAnnotationObject);
		this.overlay.fabricCanvas().setActiveObject(this.currentAnnotationObject);
		this.overlay.fabricCanvas().renderAll();

		//$(".to-delete").remove();
	},


	//used to detect auto size of a primitive object (rect/ellipse)
	_getSimpleApproxObjectBounds: function (eventPosition) {
		//TODO move this beginning logic to handler

		var viewportPos = PLUGINS.osd.viewport.pointFromPixel(eventPosition);
		//var imagePoint = PLUGINS.dataLayer.viewportToImageCoordinates(viewportPos);
		var originPoint = PLUGINS.osd.viewport.pixelFromPoint(viewportPos);
		this.changeTile(viewportPos);

		//todo unused, maybe round origin point...?
		// eventPosition.x = Math.round(eventPosition.x);
		// eventPosition.y = Math.round(eventPosition.y);

		this.comparator = function (pix) {
			return (pix[3] > this.alphaSensitivity && (pix[0] > 200 || pix[1] > 200));
		}

		//var originPoint = getOriginPoint(eventPosition);
		let origPixel = this.getPixelData(originPoint);
		var x = originPoint.x;  // current x position
		var y = originPoint.y;  // current y position

		if (!this.comparator(origPixel)) {
			//default object of width 40
			return { top: this.toGlobalPointXY(x, y - 20), left: this.toGlobalPointXY(x - 20, y), bottom: this.toGlobalPointXY(x, y + 20), right: this.toGlobalPointXY(x + 20, y) }
		};

		while (this.getAreaStamp(x, y) == 15) {
			x += 2;
		}
		var right = this.toGlobalPointXY(x, y);
		x = originPoint.x;

		while (this.getAreaStamp(x, y) == 15) {
			x -= 2;
		}
		var left = this.toGlobalPointXY(x, y);
		x = originPoint.x;

		while (this.getAreaStamp(x, y) == 15) {
			y += 2;
		}
		var bottom = this.toGlobalPointXY(x, y);

		y = originPoint.y;
		while (this.getAreaStamp(x, y) == 15) {
			y -= 2;
		}
		var top = this.toGlobalPointXY(x, y);

		return { top: top, left: left, bottom: bottom, right: right }
	},


	//if first direction cannot be persued, other take over for some time
	// primaryDirection - where pixel is tested, directions - where the recursion is branching, resultingPoints - to push border points(result),
	// speed - how many pixels skip, evaluator - function that takes a position and returns bool - True if valid pixel
	_growRegion: function (x, y, bitsX, bitsY, bitsmap, resultingPoints, speed, evaluator) {

		if (bitsX < 0 || bitsX >= bitsmap.dimension || bitsY < 0 || bitsY >= bitsmap.dimension) {
			//todo stop here, add the point or believe it was being taken care of before??
			resultingPoints.push([x, y]);
			return;
		}

		let newP = new OpenSeadragon.Point(x, y);
		//console.log(`${bitsX}, ${bitsY}:: ${x}, ${y}`)
		if (evaluator(newP)) {
			resultingPoints.push([newP.x, newP.y]);

			if (!bitsmap.isFlag(bitsX + 1, bitsY)) {
				bitsmap.setFlag(bitsX + 1, bitsY);
				this._growRegion(x + speed, y, bitsX + 1, bitsY, bitsmap, resultingPoints, speed, evaluator);
			}
			if (!bitsmap.isFlag(bitsX - 1, bitsY)) {
				bitsmap.setFlag(bitsX - 1, bitsY);
				this._growRegion(x - speed, y, bitsX - 1, bitsY, bitsmap, resultingPoints, speed, evaluator);
			}
			if (!bitsmap.isFlag(bitsX, bitsY + 1)) {
				bitsmap.setFlag(bitsX, bitsY + 1);
				this._growRegion(x, y + speed, bitsX, bitsY + 1, bitsmap, resultingPoints, speed, evaluator);
			}
			if (!bitsmap.isFlag(bitsX, bitsY - 1)) {
				bitsmap.setFlag(bitsX, bitsY - 1);
				this._growRegion(x, y - speed, bitsX, bitsY - 1, bitsmap, resultingPoints, speed, evaluator);
			}
		}
		//else: try to go pixel by pixel back to find the boundary
	},

	//if first direction cannot be persued, other take over for some time
	// primaryDirection - where pixel is tested, directions - where the recursion is branching, resultingPoints - to push border points(result),
	// speed - how many pixels skip, evaluator - function that takes a position and returns bool - True if valid pixel
	_growRegionInDirections: function (x, y, primaryDirection, directions, resultingPoints, speed, evaluator, maxDist = -1, _primarySubstitued = false) {
		let newP = new OpenSeadragon.Point(x + primaryDirection[0] * speed, y + primaryDirection[1] * speed)

		if (maxDist === 0) {
			resultingPoints.push([x, y]);
			return;
		}

		var valid = true;
		if (evaluator(newP)) {

			//TODO PUT SOME INSIDE POINTS AS WELL, OTHERWISE CONVEX HULL FAILS TO COMPUTE COREECT OUTLINE

			//if (Math.random() > 0.8) {
			resultingPoints.push([newP.x, newP.y]);
			//if (maxDist > 0) $("#osd").append(`<span style="position:absolute; top:${newP.y}px; left:${newP.x}px; width:5px;height:5px; background:blue;" class="to-delete"></span>`);

			//$("#osd").append(`<span style="position:absolute; top:${newP.y}px; left:${newP.x}px; width:5px;height:5px; background:blue;" class="to-delete"></span>`);
			//}

			if (_primarySubstitued && directions[0]) {
				valid &= this._growRegionInDirections(newP.x, newP.y, directions[0], [primaryDirection], resultingPoints, speed, evaluator, maxDist--, false);
			}

			if (valid) {
				this._growRegionInDirections(newP.x, newP.y, primaryDirection, directions, resultingPoints, speed, evaluator, maxDist--, _primarySubstitued);

				for (var i = 0; i < directions.length; i++) {
					this._growRegionInDirections(newP.x, newP.y, directions[i], [], resultingPoints, speed, evaluator, maxDist--, _primarySubstitued);
				}
			}

			return valid;
		} else {

			if (!_primarySubstitued) {
				//TODO due to speed probably imprecise, try to find exact border by going forward by 1?

				// let point = this.toGlobalPoint(new OpenSeadragon.Point(Math.round(x), Math.round(y)));
				// resultingPoints.push(point); //border point

				// resultingPoints.push([point.x, point.y]); //border point

				if (maxDist < 0) {
					do {
						newP.x -= primaryDirection[0];
						newP.y -= primaryDirection[1];
					} while (!evaluator(newP));
				}

				resultingPoints.push([newP.x, newP.y]);

				//$("#osd").append(`<span style="position:absolute; top:${newP.y}px; left:${newP.x}px; width:5px;height:5px; background:blue;" class="to-delete"></span>`);

				for (var i = 0; i < directions.length; i++) {
					this._growRegionInDirections(x + directions[i][0] * speed, y + directions[i][1] * speed, directions[i], [primaryDirection], resultingPoints, speed, evaluator, maxDist--, true);
				}
			}
			return false;
		}
	},

	/****************************************************************************************************************

									HELPER OSD/FABRIC FUNCTIONS (manipulation with pixels and coordinates)

	*****************************************************************************************************************/

	toScreenCoords: function (x, y) {
		return PLUGINS.dataLayer.imageToWindowCoordinates(new OpenSeadragon.Point(x, y));
	},

	toGlobalPointXY: function (x, y) {
		return PLUGINS.dataLayer.windowToImageCoordinates(new OpenSeadragon.Point(x, y));
	},

	toGlobalPoint: function (point) {
		return PLUGINS.dataLayer.windowToImageCoordinates(point);
	},

	getCursorXY: function (e) {
		return new OpenSeadragon.Point(e.pageX, e.pageY);
	},

	getGlobalCursorXY: function (e) {
		return this.getGlobalCursorXY(this.getCursorXY(e));
	},

	toDistanceObj: function (pointA, pointB) {
		return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
	},

	toDistanceList: function (pointA, pointB) {
		return Math.hypot(pointB[0] - pointA[0], pointB[1] - pointA[1]);
	},

	// set currentTile to tile where is the event
	changeTile: function (viewportPos) {
		var i = 0;
		PLUGINS.dataLayer.lastDrawn.forEach(function (tile) {
			if (tile.bounds.containsPoint(viewportPos)) {
				openseadragon_image_annotations.currentTile = tile;
				return;
			};
		});
	},

	isSimilarPixel: function (eventPosition, toPixel) {
		let pix = this.getPixelData(eventPosition);
		for (let i = 0; i < 4; i++) {
			//todo dynamic or sensitivity based threshold?
			if (Math.abs(pix[i] - toPixel[i]) > 10) return false;
		}
		return this.comparator(pix);
	},

	isValidPixel: function (eventPosition) {
		return this.comparator(this.getPixelData(eventPosition));
	},

	getPixelData: function (eventPosition) {
		//change only if outside
		if (!this.currentTile.bounds.containsPoint(eventPosition)) {
			this.changeTile(PLUGINS.osd.viewport.pointFromPixel(eventPosition));
		}

		// get position on a current tile
		var x = eventPosition.x - this.currentTile.position.x;
		var y = eventPosition.y - this.currentTile.position.y;

		// get position on DZI tile (usually 257*257)
		var relative_x = Math.round((x / this.currentTile.size.x) * this.currentTile.context2D.canvas.width);
		var relative_y = Math.round((y / this.currentTile.size.y) * this.currentTile.context2D.canvas.height);


		return this.currentTile.context2D.getImageData(relative_x, relative_y, 1, 1).data;
	},

	// CHECKS 4 neightbouring pixels and returns which ones are inside the specified region
	//  |_|_|_|   --> topRight: first (biggest), bottomRight: second, bottomLeft: third, topLeft: fourth bit
	//  |x|x|x|   --> returns  0011 -> 0*8 + 1*4 + 1*2 + 0*1 = 6, bottom right & left pixel inside
	//  |x|x|x|
	getAreaStamp: function (x, y) {
		var result = 0;
		if (this.isValidPixel(new OpenSeadragon.Point(x + 1, y - 1))) {
			result += 8;
		}
		if (this.isValidPixel(new OpenSeadragon.Point(x + 1, y + 1))) {
			result += 4;
		}
		if (this.isValidPixel(new OpenSeadragon.Point(x - 1, y + 1))) {
			result += 2;
		}
		if (this.isValidPixel(new OpenSeadragon.Point(x - 1, y - 1))) {
			result += 1;
		}
		return result;
	},

	/****************************************************************************************************************
 
					OBJECT PROPERTIES - passed to object.create(...)
 
	 *****************************************************************************************************************/

	objectOptionsLeftClick: {
		fill: "#58994c",
		selectable: true,
		strokeWidth: 2,
		borderColor: '#fbb802',
		cornerColor: '#fbb802',
		stroke: 'black',
		borderScaleFactor: 3,
		hasControls: false,
		//todo get it once
		isLeftClick: true,
		hasRotatingPoint: false,
		comment: null
		},

	objectOptionsRightClick:{
		fill: "#d71818",
		selectable: true,
		strokeWidth: 2,
		borderColor: '#fbb802',
		cornerColor: '#fbb802',
		stroke: 'black',
		borderScaleFactor: 3,
		hasControls: false,
		//todo get it once
		isLeftClick: false,
		hasRotatingPoint: false,
		comment: null
	},

	objectOptions: function(isLeftClick) {
		if (isLeftClick) {
			this.objectOptionsLeftClick.opacity = this.opacity.val();
			return this.objectOptionsLeftClick;
		}
		this.objectOptionsRightClick.opacity = this.opacity.val();
		return this.objectOptionsRightClick;
	},

	/****************************************************************************************************************
 
									 A N N O T A T I O N S (User driven Initializers and Updaters)
 
	 *****************************************************************************************************************/


	setFabricCanvasInteractivity: function (boolean) {
		this.overlay.fabricCanvas().forEachObject(function (object) {
			object.selectable = boolean;
		});
	},

	deselectFabricObjects: function () {
		this.overlay.fabricCanvas().deactivateAll().renderAll();
	},


	// delete the currently selected annotation from the canvas
	deleteActiveAnnotation: function () {
		// Break out if no annotation is currently selected
		if (this.overlay.fabricCanvas().getActiveObject() == null) {
			this.messenger.show("Please select the annotation you would like to delete", 3000, this.messenger.MSG_INFO);
			return;
		}
		var annotation = this.overlay.fabricCanvas().getActiveObject();
		if (annotation.type == "rect" || annotation.type == "polygon") {
			annotation.remove();
		};

	},

	// Get all objects from canvas
	deleteAllAnnotations: function () {
		var objects = openseadragon_image_annotations.overlay.fabricCanvas().getObjects();
		/* if objects is null, catch */
		if (objects.length == 0) {
			console.log("No annotations on canvas to delete");
			return;
		}
		var objectsLength = objects.length
		for (var i = 0; i < objectsLength; i++) {
			this.history.push(null, objects[objectsLength - i - 1]);
			objects[objectsLength - i - 1].remove();
		}
	},


	turnAnnotationsOnOff: function (on) {

		var objects = this.overlay.fabricCanvas().getObjects();
		if (on) {
			this.showAnnotations = true;
			//set all objects as visible and unlock
			for (var i = 0; i < objects.length; i++) {
				objects[i].visible = true;
				objects[i].lockMovementX = false;
				objects[i].lockMovementY = false;
				objects[i].lockRotation = false;
				objects[i].lockScalingFlip = false;
				objects[i].lockScalingX = false;
				objects[i].lockScalingY = false;
				objects[i].lockSkewingX = false;
				objects[i].lockSkewingY = false;
				objects[i].lockUniScaling = false;
			}
			if (this.cachedTargetCanvasSelection) {
				this.overlay.fabricCanvas().setActiveObject(this.cachedTargetCanvasSelection);

			}
		} else {
			this.cachedTargetCanvasSelection = this.overlay.fabricCanvas().getActiveObject();
			this.history.highlight(null);

			this.showAnnotations = false;
			for (var i = 0; i < objects.length; i++) {
				//set all objects as invisible and lock in position
				objects[i].visible = false;
				objects[i].lockMovementX = true;
				objects[i].lockMovementY = true;
				objects[i].lockRotation = true;
				objects[i].lockScalingFlip = true;
				objects[i].lockScalingX = true;
				objects[i].lockScalingY = true;
				objects[i].lockSkewingX = true;
				objects[i].lockSkewingY = true;
				objects[i].lockUniScaling = true;
			}
			this.overlay.fabricCanvas().deactivateAll().renderAll();
			//$("#input_form").hide();
		}
		this.overlay.fabricCanvas().renderAll();
	},

	// set input form with default values or annotation attributes
	//(e.g if annotation was imported)
	// set_input_form: function (annotation) {
	// 	//todo remove this feature?

	// 	if (annotation.comment) {
	// 		document.getElementById("annotation_comment").value = annotation.comment;
	// 	} else { document.getElementById("annotation_comment").value = "" };

	// 	if (!(annotation.a_group)) {
	// 		annotation.set({ a_group: "None" })
	// 	};
	// 	document.getElementById("annotation_group").value = annotation.a_group;


	// 	//todo more modular?
	// 	// if (!(annotation.threshold)) {
	// 	// 	annotation.set({ threshold: document.getElementById("Threshold").innerHTML })
	// 	// };
	// 	document.getElementById("annotation_threshold").innerHTML = annotation.threshold;

	// 	// set position of the input form
	// 	var viewport_coordinates = PLUGINS.osd.world.getItemAt(0).imageToViewportCoordinates(annotation.left + annotation.width, annotation.top);
	// 	var pixel_coordinates = PLUGINS.osd.viewport.pixelFromPoint(viewport_coordinates);
	// 	document.getElementById("input_form").style.position = "absolute";
	// 	document.getElementById("input_form").style.top = String(pixel_coordinates.y - 10) + "px";
	// 	document.getElementById("input_form").style.left = String(pixel_coordinates.x + 10) + "px";
	// },

	//cursor management (TODO move here other stuff involving cursor too)
	// updater: function(mousePosition: OSD Point instance, cursorObject: object that is being shown underneath cursor)
	//todo not working
	cursor: {
		_visible: false,
		_updater: null,
		_node: null,
		_toolRadius: 0,

			/* Mouse touch related data */
		//TODO move to cursor class object
		mouseTime: 0, //OSD handler click timer
		isDown: false,  //FABRIC handler click down recognition
		//isOverObject: false,

		init: function () {
			this._node = document.getElementById("annotation-cursor");
		},

		updateRadius: function () {
			this._toolRadius = openseadragon_image_annotations.modifyTool.getScreenToolRadius();
		},

		getHTMLNode: function () {
			return this._node;
		},

		show: function () {
			if (this._listener) return;
			//this._node.css({display: "block", width: this._toolRadius+"px", height: this._toolRadius+"px"});
			this._node.style.display = "block";
			this.updateRadius();
			this._node.style.width = (this._toolRadius * 2) + "px";
			this._node.style.height = (this._toolRadius * 2) + "px";
			// this._node.style.top = e.pageY + "px";
			// this._node.style.left = e.pageX + "px";

			const c = this._node;

			this._visible = true;
			this._listener = e => {
				c.style.top = e.pageY + "px";
				c.style.left = e.pageX + "px";


			};
			window.addEventListener("mousemove", this._listener);
		},

		hide: function () {
			if (!this._listener) return;
			this._node.style.display = "none";
			this._visible = false;
			window.removeEventListener("mousemove", this._listener);
			this._listener = null;
		},
	}
}; // end of namespace



Messenger = function () {
	this.MSG_INFO = { class: "", icon: '<path fill-rule="evenodd"d="M6.3 5.69a.942.942 0 0 1-.28-.7c0-.28.09-.52.28-.7.19-.18.42-.28.7-.28.28 0 .52.09.7.28.18.19.28.42.28.7 0 .28-.09.52-.28.7a1 1 0 0 1-.7.3c-.28 0-.52-.11-.7-.3zM8 7.99c-.02-.25-.11-.48-.31-.69-.2-.19-.42-.3-.69-.31H6c-.27.02-.48.13-.69.31-.2.2-.3.44-.31.69h1v3c.02.27.11.5.31.69.2.2.42.31.69.31h1c.27 0 .48-.11.69-.31.2-.19.3-.42.31-.69H8V7.98v.01zM7 2.3c-3.14 0-5.7 2.54-5.7 5.68 0 3.14 2.56 5.7 5.7 5.7s5.7-2.55 5.7-5.7c0-3.15-2.56-5.69-5.7-5.69v.01zM7 .98c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.12-7-7 3.14-7 7-7z"/>' };
	this.MSG_WARN = { class: "Toast--warning", icon: '<path fill-rule="evenodd" d="M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z" />' };
	this.MSG_ERR = { class: "Toast--error", icon: '<path fill-rule="evenodd" d="M10 1H4L0 5v6l4 4h6l4-4V5l-4-4zm3 9.5L9.5 14h-5L1 10.5v-5L4.5 2h5L13 5.5v5zM6 4h2v5H6V4zm0 6h2v2H6v-2z" />' };
	this._timer = null;

	$("body").append(`<div id="annotation-messages-container" class="Toast popUpHide position-fixed" style='z-index: 5050; transform: translate(calc(50vw - 50%));'>
		  <span class="Toast-icon"><svg width="12" height="16"v id="annotation-icon" viewBox="0 0 12 16" class="octicon octicon-check" aria-hidden="true"></svg></span>
		  <span id="annotation-messages" class="Toast-content v-align-middle"></span>
		  <button class="Toast-dismissButton" onclick="openseadragon_image_annotations.messenger.hide(false);">
			<svg width="12" height="16" viewBox="0 0 12 16" class="octicon octicon-x" aria-hidden="true"><path fill-rule="evenodd" d="M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z"/></svg>
		  </button>
		  </div>`);

	this._body = $("#annotation-messages-container");
	this._board = $("#annotation-messages");
	this._icon = $("#annotation-icon");
}
Messenger.prototype = {
	show: function (text, delayMS, importance) {
		this._board.html(text);
		this._icon.html(importance.icon);
		this._body.removeClass(); //all
		this._body.addClass(`Toast position-fixed ${importance.class}`)
		this._body.removeClass("popUpHide");
		this._body.addClass("popUpEnter");

		if (delayMS > 1000) {
			this._timer = setTimeout(this.hide.bind(this), delayMS);
		}
	},

	hide: function (_autoCalled = true) {
		console.log("remove", this._body)
		this._body.removeClass("popUpEnter");
		this._body.addClass("popUpHide");

		if (!_autoCalled) {
			clearTimeout(this._timer);
		}
		this._timer = null;
	}
}  // end of namespace messenger


/*------------ Initialization of OSD Annotations ------------*/
var openseadragon_image_annotations = new OSDAnnotations();
  
  
PLUGINS.osd.addHandler('open', function() {
	var options = {
		scale: PLUGINS.imageLayer.source.Image.Size.Width,
		fireRightClick: true
	};

	openseadragon_image_annotations.initialize(PLUGINS.postData.annotations, options);
});
  
  