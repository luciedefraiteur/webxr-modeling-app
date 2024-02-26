import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import * as THREE from "three";
import {time, timeStamp} from "console";
import {DragControls} from "three/examples/jsm/controls/DragControls";
import {VRButton} from "three/examples/jsm/webxr/VRButton";
import {ARButton} from "three/examples/jsm/webxr/ARButton";
import {XRControllerModelFactory} from "three/examples/jsm/webxr/XRControllerModelFactory";
import {XRHandModelFactory} from "three/examples/jsm/webxr/XRHandModelFactory";
import * as THREEMeshUI from "three-mesh-ui";
import { UniqueIDHelper } from "../utils/UniqueIDHelper";
export class XRAppXRSession
{
    hand1: THREE.XRHandSpace;
    hand2: THREE.XRHandSpace;
    controllerGrip1: THREE.XRGripSpace;
    controllerGrip2: THREE.XRGripSpace;
    enableSpectatorCam: boolean = false;
    controller1: THREE.XRTargetRaySpace;
    controller2: THREE.XRTargetRaySpace;
    dragControls: DragControls;

    offerSession()
    {
        if((navigator as any).xr.offerSession === undefined) return;

        console.log("offering new session now");
        (navigator as any).xr
            .offerSession('immersive-ar', {optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers']})
            .then((session) =>
            {
                console.log("offered session has been accepted", session);
                this.renderer.xr.setSession(session);
            });
    }

    static platformIsPowerfulEnoughToRenderPasses()
    {
        const ua = window.navigator.userAgent;
        const standalone = /Windows|MacOS/.test(ua);
        const isHololens = /Windows NT/.test(ua) && /Edg/.test(ua) && !/Win64/.test(ua);
        return standalone && !isHololens;
    }


    constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, public controls: OrbitControls)
    {
        // dragging on screen


        const onSelectEnd = (event) =>
        {

            const controller = event.target;
            if(!controller) return;
            console.log("select end", event, controller);

            /*if(controller.userData.selected !== undefined)
            {

                const object = controller.userData.selected;
                object.material.emissive.b = 0;
                group.attach(object);
                console.log("detaching", object);

                controller.userData.selected = undefined;

                endPossibleClick();
            }*/
        }

        // donc faut que yai accés ici en plus, aux objets à intersecter?
        // a la fonction de rendu spectateur
        // aux orbit controls?
        const onSelectStart = (event, delayedTarget?) =>
        {

            // WORKAROUND for threejs and/or WebXR issue: sometimes the controller pose on AR is delayed by a frame or two
            // see https://github.com/mrdoob/three.js/issues/23186

            if(!delayedTarget)
            {
                const trgt = event.target;
                setTimeout(() =>
                {
                    onSelectStart(event, trgt);
                }, 50);
                return;
            }

            const controller = delayedTarget || event.target;
            console.log("select start", event, controller, delayedTarget);

            /*const intersections = getIntersections(controller);
            if(intersections.length > 0)
            {

                const intersection = intersections[0];

                const object = intersection.object;
                (object as any).material.emissive.b = 1;
                controller.attach(object);
                console.log("attaching", object);

                controller.userData.selected = object;

                startPossibleClick();
            }*/

        }

        const onSessionEvent = (event) =>
        {
            console.log("session event", event);
        }

        const onInputSourcesChange = (event) =>
        {
            console.log("input sources change", event);
        }

        const vrButton = VRButton.createButton(renderer);
        document.body.appendChild(vrButton);
        vrButton.style.marginLeft = '-80px';
        // local-floor doesn't work right now, three ARButton overrides it
        // hand-tracking is required to have hands on Hololens in AR mode
        const arButton = ARButton.createButton(renderer, {
            optionalFeatures: ['hand-tracking', 'local-floor', 'dom-overlay']
        } as any);
        document.body.appendChild(arButton);
        arButton.style.marginLeft = '80px';

        // xr events to show / hide the floor and background in AR

        renderer.xr.addEventListener('sessionstart', function(event)
        {

            const session = renderer.xr.getSession();
            console.log('sessionstart', session);

            // see https://developer.mozilla.org/en-US/docs/Web/API/XRSession/environmentBlendMode
            if(('environmentBlendMode' in session) && (session.environmentBlendMode === 'additive' || session.environmentBlendMode === 'alpha-blend'))
            {

                scene.background = null;

            }

            // debugging
            session.addEventListener('select', onSessionEvent);
            session.addEventListener('selectstart', onSessionEvent);
            session.addEventListener('selectend', onSessionEvent);
            session.addEventListener('squeeze', onSessionEvent);
            session.addEventListener('squeezestart', onSessionEvent);
            session.addEventListener('squeezeend', onSessionEvent);
            session.addEventListener('inputsourceschange', onInputSourcesChange);

        });

        renderer.xr.addEventListener('sessionend', function(event)
        {

            console.log('sessionend');
            //!! scene.background = background;

        });

        // controllers

        this.controller1 = renderer.xr.getController(0);
        this.controller1.addEventListener('selectstart', (evt) =>
        {
            console.log("START 1", evt);
            onSelectStart(evt);
        });
        this.controller1.addEventListener('selectend', evt =>
        {
            console.log("END 1", evt);
            onSelectEnd(evt);
        });
        scene.add(this.controller1);

        this.controller2 = renderer.xr.getController(1);
        this.controller2.addEventListener('selectstart', (evt) =>
        {
            console.log("START 2", evt);
            onSelectStart(evt);
        });
        this.controller2.addEventListener('selectend', evt =>
        {
            console.log("END 2", evt);
            onSelectEnd(evt);
        });
        scene.add(this.controller2);

        const controllerModelFactory = new XRControllerModelFactory();

        this.controllerGrip1 = renderer.xr.getControllerGrip(0);
        this.controllerGrip1.add(controllerModelFactory.createControllerModel(this.controllerGrip1));
        scene.add(this.controllerGrip1);

        this.controllerGrip2 = renderer.xr.getControllerGrip(1);
        this.controllerGrip2.add(controllerModelFactory.createControllerModel(this.controllerGrip2));
        scene.add(this.controllerGrip2);

        const handModelFactory = new XRHandModelFactory();

        // change this line to a specific path to test custom hand models:
        // handModelFactory.setPath("https://cdn.glitch.global/53fee240-c36e-4d43-9f91-54314d6b48cf/");

        this.hand1 = renderer.xr.getHand(0);
        this.hand1.add(handModelFactory.createHandModel(this.hand1, "mesh"));

        scene.add(this.hand1);

        this.hand2 = renderer.xr.getHand(1);
        this.hand2.add(handModelFactory.createHandModel(this.hand2, "mesh"));

        scene.add(this.hand2);

        //

        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, - 1)]);

        const line = new THREE.Line(geometry);
        line.name = 'line';
        line.scale.z = 5;

        this.controller1.add(line.clone());
        this.controller2.add(line.clone());

        this.dragControls = new DragControls([], camera, renderer.domElement);
        this.dragControls.addEventListener('drag', () =>
        {
            // currently dragging.
            // they called "render" function, certainly to intersect etc...
        });
        this.dragControls.addEventListener('dragstart', function(event) {controls.enabled = false;});
        this.dragControls.addEventListener('dragend', function(event) {controls.enabled = true;});

        // spectator cam

        this.enableSpectatorCam = XRAppXRSession.platformIsPowerfulEnoughToRenderPasses();

        // offersession testing
        document.querySelector("#sessionofferbtn").addEventListener("click", evt =>
        {
            this.offerSession();
        });

        document.querySelector("#session-freeze").addEventListener("click", evt =>
        {
            // freeze for 500ms
            setInterval(() =>
            {
                const time = Date.now();
                const targetTime = time + 500;
                while(Date.now() < targetTime) { }
            }, 3000);
        });

        // sessiongranted testing
        (navigator as any).xr.addEventListener('sessiongranted', () =>
        {
            console.log("session has been granted");
            (navigator as any).xr
                .requestSession('immersive-ar', {optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers']})
                .then(async (session) =>
                {
                    console.log("sessiongranted session has been started");
                    await renderer.xr.setSession(session);
                    console.log("have set session");
                });
        });

        // escape to exit VR
        window.addEventListener("keydown", (e) =>
        {
            if(e.key === "Escape")
            {
                renderer.xr.getSession()?.end();
            }
        });
    }
    renderSpectator()
    {
        if(this.enableSpectatorCam && this.renderer.xr.isPresenting)
        {

            const wasXr = this.renderer.xr.enabled;
            const previousRenderTarget = this.renderer.getRenderTarget();

            this.renderer.xr.enabled = false;
            this.renderer.setRenderTarget(null);

            this.renderer.render(this.scene, this.camera);

            this.renderer.xr.enabled = wasXr;
            this.renderer.setRenderTarget(previousRenderTarget);

        }
    }
}



export class DesktopController
{
    grabbedItem: XRUIItem;
    update()
    {

    }
}

export class XRUser
{
    controllers: (XRController | DesktopController)[] = [];
    mode: "XR" | "desktop" = "XR";
    constructor(public readonly xrApp: XRApp)
    {
        this.controllers.push(new XRController(xrApp, 0));
        this.controllers.push(new XRController(xrApp, 1));
    }
    update()
    {
        for(let i = 0; i < this.controllers.length; i++)
        {
            this.controllers[i].update();
        }
    }
}


export class XRUI
{
    mode: "xr" | "mouse";

    items: XRUIItem[] = [];
    raycast = (() =>
    {
        const rc = new THREE.Raycaster();
        return ((origin: THREE.Vector3, direction: THREE.Vector3) =>
        {
            rc.set(origin, direction);
            const intersects = rc.intersectObjects(this.items, false);
            return (intersects.map((a) =>
            {
                return ({intersect: a, uiItem: a.object as XRUIItem});
            }));

        });
    })();

}

export abstract class XRUIItem extends THREE.Group
{
    //!! we could ask consent for possession, so the object could ignore a specific controller.
    /**
     * Don't edit this list, it is the ordered list of controllers that are owning us. 
     */
    possessed: XRController[] = [];
    public onHover?(controller: XRController, intersection: THREE.Intersection<THREE.Object3D<THREE.Event>>): void;
    public onPointerEnter?(controller: XRController, intersection: THREE.Intersection<THREE.Object3D<THREE.Event>>): void;
    public onPointerLeave?(controller: XRController, intersection: THREE.Intersection<THREE.Object3D<THREE.Event>>): void;
    public onClick?(): void; // will i start to drag, or whatever action on clicked.
    public onPointerDown?(): void; // etc...
    public onPointerUp?(): void;
}

export class XRController
{
    mode: "dragging" | "none";
    grabbedItem: XRUIItem;
    hoveredItems: XRUIItem[];

    targetRaySpace: THREE.XRTargetRaySpace;
    handSpace: THREE.XRHandSpace;
    gripSpace: THREE.XRGripSpace;
    constructor(public readonly xrApp: XRApp, controllerIndex: number)
    {
        // controllers
        const controller1 = xrApp.renderer.xr.getController(controllerIndex);
        this.targetRaySpace = controller1;

        controller1.addEventListener('selectstart', (evt) =>
        {
            console.log("START 1", evt);
            //onSelectStart(evt);
        });
        controller1.addEventListener('selectend', evt =>
        {
            console.log("END 1", evt);
            //onSelectEnd(evt);
        });

        xrApp.scene.add(controller1);

        const controllerModelFactory = new XRControllerModelFactory();

        const controllerGrip1 = xrApp.renderer.xr.getControllerGrip(controllerIndex);
        this.gripSpace = controllerGrip1;
        controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
        xrApp.scene.add(controllerGrip1);
        const handModelFactory = new XRHandModelFactory();

        // change this line to a specific path to test custom hand models:
        // handModelFactory.setPath("https://cdn.glitch.global/53fee240-c36e-4d43-9f91-54314d6b48cf/");

        const hand1 = xrApp.renderer.xr.getHand(controllerIndex);
        this.handSpace = hand1;

        hand1.add(handModelFactory.createHandModel(hand1, "mesh"));

        xrApp.scene.add(hand1);

        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, - 1)]);

        const line = new THREE.Line(geometry);
        line.name = 'line';
        line.scale.z = 5;

        controller1.add(line.clone());

    }
    
    update()
    {
        const olds = this.hoveredItems;
        const tempMatrix: THREE.Matrix4 = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(this.targetRaySpace.matrixWorld);

        const origin = new THREE.Vector3().setFromMatrixPosition(this.targetRaySpace.matrixWorld);
        const direction = new THREE.Vector3().set(0, 0, - 1).applyMatrix4(tempMatrix);

        const newHovereds = this.xrApp.ui.raycast(origin, direction);; //  XRUI.raycast ui raycast...
        const firstIntersect = (0 == newHovereds.length) ? undefined : newHovereds[0];
        const isHovered: {[index: string] : boolean} = {};
        newHovereds.forEach((newHovered) => {
            isHovered[UniqueIDHelper.GetUUID(newHovered)] = true;
        });
        const alreadyHovered: {[index: string] : boolean} = {};
        olds.forEach(old => {
            if (!(isHovered[UniqueIDHelper.GetUUID(old)]))
            {
                
                const index = old.possessed.indexOf(this);
                if (index < 0)
                {
                    throw new Error("[XRController] : possessed object not found.");
                }
                old.possessed.splice(index, 1);
                old.onPointerLeave(this, (firstIntersect !== undefined) ? firstIntersect.intersect : undefined);
            }
            else
            {
                alreadyHovered[UniqueIDHelper.GetUUID(old)] = true;
            }
        });
        newHovereds.forEach((newHovered) => {
            if (!(alreadyHovered[UniqueIDHelper.GetUUID(newHovered)]))
            {
                newHovered.uiItem.possessed.push(this);
                newHovered.uiItem.onPointerEnter(this, newHovered.intersect);
            }
            newHovered.uiItem.onHover(this, newHovered.intersect);
        });
    }

}

/*

// chaque main est indépendante, peut s'updater de manière autonome
//  et sans connaissance des autres mains,
// juste des objets qui ont déja une possession par une main.


XRController.grabbedItems = { [ 'item-uuuid'] : objectDragData }
// et pour simplifier en attendant des véritables selections:
XRControlleR.grabbedItem = {uuid: 'item-uuid' , dragInfo: DragInfo }


// situation: je keydown avec tel boutton de tel controlleur




XRApp.update()
{
    for (let i = 0; i < users.length; i++)
    {
        users[i].update();
    }
}

XRUser.update()
{
    controllers: XRController | DesktopController
    for (let i = 0; i < controllers.length; i++)
    {
        controllers[i].update();
    }
}

XRController.threeController: XRTargetRaySpace
XRController.constructor()
{
    add event for that that that...
}

XRController.hoveredItem = undefined;

XRController.update()
{
const old = this.hoveredItem;
  this.hoveredItem = ui raycast...
  if (this.hoveredItem !== old && checkPossession(old))
  {
    old.clearVisuals();
  }
  this.hoveredItem.hoverVisuals();
}


XRController.clickCandidate = {uuid: string, mouseDownTime: number }

XRController.mouseDown()
{
    mouseDown = ui raycast...
    mouseDown.mouseDown(this);
    this.clickCandidate = {mouseDown, time}
}

XRController.mouseUp()
{
    if (this.clickCandidate)
    {
        if (time - this.clickCandidate.time < MOUSE_CLICK_MAX_DURATION)
        {
            this.clickCandidate.mouseDown.click();
        }
        else
        {
            const obj = this.clickCandiate.mouseDown;
            obj.grabbedVisual(this);
            this.grab(obj);
        }
        this.clickCandidate = undefined;

    }
}

    XRUser ? (un par personne utilisant la xr)

    XRSelector ? (genre yen a un par controller et un pour la souris? et ça gère une selection etc propre au controlleur en question? )

    XRSelectable ? (quel paradigme pour vérouiller un objet entre plusieurs selector?)

    // Paradigme peut et doit permettre réseau, (+ de controlleurs en tout genre)


    XRUI: possède tout les réf XRUIItem en tant que items[];

    XRUI peut gérer seul son raycast, mais c'est tout:

    `let hoveredButton = (XRUI.raycast());`

    XRControl:

    XRControl.mode === XRControlMode.Mouse | XRControlMode.XR

    XRCOntrol.update()
    {
        if (mouseDown)
        {
            switch (this.mode)
            {
                case (XRControlMode.XR):
                {
                    let hoveredUI = XRUI.raycast();
                    
                    hoveredUI.onHover();
                    break;
                }
            }

        }
    }

    on cast sur tout les items sans récursivitée? 
    l'important est que l'on trouve l'objet le plus proche.

    ou on cast sur tout les grand parents?

    rep: c'est pas important pour le moment sur tout les items.

    les XRUIItem ont des comportements différents au hover etc...    
    XRUIDragBar // va se débrouiller pour qu'on le drag avec tout ses enfants.
    XRUIButton // va se débrouiller pour etre clickable.
    XRUIPannel // contient juste des boutons.
    XRUIContainer // dragbar + panel + corner.
    XRUICorner // permet de resize un container.
    

    pour l'instant ça se réduit à ça, mais dans le futur éventuellement des choses plus compliquées, menu vertical/horizontal etc...
    en copiant un peu sur l'ui d'unity.

*/





/*
    ui got a mode, between 3

*/

export interface XRCommandPanelOptions
{
    commands?: {[index: string]: (self?: XRCommandPanel, buttonName?: string) => {}},
    buttonHeight?: number,
    buttonWidth?: number,
}
/*

    XRUIInteraction -> main ui interaction system.

        register(ui: XRUI) register an ui panel or button?
        {

        }

    XRUIPanel -> main panel class, it helps us to have the little draggable window etc like in oculus.

    Grab logic?
        XRUIPanel.update(); -> update check for raycast with any ui 



*/

export class XRCommandPanel extends THREE.Object3D
{
    createButtonPanel(index: number)
    {

    }
    private static _defaultOptions: Required<XRCommandPanelOptions> | undefined;
    private static get defaultOptions(): Required<XRCommandPanelOptions>
    {
        if(this._defaultOptions == undefined)
        {
            this._defaultOptions = {
                buttonHeight: 0.5,
                buttonWidth: 1.0,
                commands: undefined
            };
        }
        return (this.defaultOptions);
    }

    constructor(options?: XRCommandPanelOptions)
    {
        super();
        const dflt = XRCommandPanel.defaultOptions;
        let reqOptions: Required<XRCommandPanelOptions>;
        if(options == undefined)
        {
            reqOptions = {...dflt};
        }
        else
        {
            reqOptions = Object.assign(options, dflt);
        }
        const commands = reqOptions.commands;
        if(commands !== undefined)
        {
            for(const key in commands)
            {
                let cmdAction = commands[key];

            }
        }
    }
    // check for raycast.
    update(deltaTime: number)
    {

    }
    click()
    {

    }
}
export class XRApp
{
    public readonly scene: THREE.Scene = new THREE.Scene();
    public readonly camera: THREE.PerspectiveCamera;
    public readonly controls: OrbitControls;
    public readonly renderer: THREE.WebGLRenderer;
    public readonly xrAppXrSession: XRAppXRSession;
    public readonly ui: XRUI;
    public render()
    {
        this.renderer.render(this.scene, this.camera);
        this.xrAppXrSession.renderSpectator();
        THREEMeshUI.update();
    }

    private initLoop = (() => 
    {
        this.renderer.setAnimationLoop(() =>
        {
            this.render();
        });
    });

    constructor()
    {
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        //deprecated: this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.xr.enabled = true;

        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
        this.camera.position.set(0, 1.6, 3);

        this.controls = new OrbitControls(this.camera, container);
        this.controls.target.set(0, 1.6, 0);
        this.controls.update();

        this.xrAppXrSession = new XRAppXRSession(this.renderer, this.scene, this.camera, this.controls);



        this.scene.background = new THREE.Color(0x808080);
        this.scene.add(new THREE.HemisphereLight(0x808080, 0x606060));

        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(0, 6, 0);
        light.castShadow = XRAppXRSession.platformIsPowerfulEnoughToRenderPasses();
        light.shadow.camera.top = 2;
        light.shadow.camera.bottom = - 2;
        light.shadow.camera.right = 2;
        light.shadow.camera.left = - 2;
        light.shadow.mapSize.set(4096, 4096);
        this.scene.add(light);

        const objects = [];
        const group = new THREE.Group();
        this.scene.add(group);

        const geometries = [
            new THREE.BoxGeometry(0.2, 0.2, 0.2),
            new THREE.ConeGeometry(0.2, 0.2, 64),
            new THREE.CylinderGeometry(0.2, 0.2, 0.2, 64),
            new THREE.IcosahedronGeometry(0.2, 8),
            new THREE.TorusGeometry(0.2, 0.04, 64, 32)
        ];

        const panel = new THREEMeshUI.Block({
            width: 2,
            height: 0.5,
            padding: 0.05,
            justifyContent: "center",
            textAlign: "center",
            fontFamily: "/assets/Roboto-msdf.json",
            fontTexture: "/assets/Roboto-msdf.png"
        });

        panel.position.set(0, 1, -1.8);
        panel.rotation.x = -0.55;
        this.scene.add(panel);

        //

        panel.add(
            new THREEMeshUI.Text({
                content: "three-mesh-ui npm package",
                fontSize: 0.125
            })
        );
        objects.push(panel);

        for(let i = 0; i < 50; i++)
        {

            const geometry = geometries[Math.floor(Math.random() * geometries.length)];
            const material = new THREE.MeshStandardMaterial({
                color: Math.random() * 0xffffff,
                roughness: 0.7,
                metalness: 0.0
            });

            const object = new THREE.Mesh(geometry, material);

            object.position.x = Math.random() * 4 - 2;
            object.position.y = Math.random() * 2;
            object.position.z = Math.random() * 4 - 2;

            object.rotation.x = Math.random() * 2 * Math.PI;
            object.rotation.y = Math.random() * 2 * Math.PI;
            object.rotation.z = Math.random() * 2 * Math.PI;

            object.scale.setScalar(Math.random() + 0.5);

            object.castShadow = true;
            object.receiveShadow = true;

            group.add(object);
            objects.push(object);
        }

        //


        container.appendChild(this.renderer.domElement);

        this.initLoop();
        const onWindowResize = () =>
        {

            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();

            this.renderer.setSize(window.innerWidth, window.innerHeight);

        };
        window.addEventListener('resize', onWindowResize);

        this.ui = new XRUI();
    }

}