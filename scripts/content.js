/*
  *
  * NOTE: le canvas injecté va changer pour utiliser celui déjà présent dans la page
  *
*/

// Durée max (ms) entre le clic sur AutoSign et l'ouverture de la page de signature
const AUTOSIGN_MAX_AGE = 2 * 60 * 1000;

// Nombre max d'essais (250 ms) pour attendre que le canvas soit affiché
const AUTOSIGN_WAIT_TRIES = 120;

// L'URL précéidente, pour vérifier si l'URL a changé
var previousURL = '';

// Vérifie si l'URL est le bon (les filtres ne marchent pas à cause de l'insertion des URLs directement dans l'historique)
setInterval(() => {
    // L'URL a changé ?
    if (previousURL != document.URL) {
        // L'URL est le bon ?
        if (document.URL == 'https://app.sowesign.com/student/signature' || document.URL == 'https://app.sowesign.com/student/recoveries') {
            // La page Angular n'est pas forcément rendue : on réessaie au prochain tick tant que le canvas n'existe pas
            if (!document.getElementsByTagName('canvas')[0] || !document.getElementsByClassName('text center border-radius padding-xs white cursor-pointer')[0]) {
                return;
            }
            main();
        }
        // L'URL a changé, on change aussi previousURL pour ne pas exécuter deux fois la fonction
        previousURL = document.URL;
    }
}, 500);

// Oui c'est dégeu mais flemme
// Le code HTML du modal injecté
const MODAL_TEXT = `
<div>
    <button style="width: 100%; height: 45px; border-radius: 5px; cursor: pointer; background-color: aliceblue;" id="wtf-file-select">Signer avec une image</button>
    <input type="file" id="wtf-file-elem" accept="image/*" style="display:none;" />
</div>
`;

// Le composant signature-pad (Angular, maison, pas la lib signature_pad) ne lit pas le canvas en continu :
// sur `mouseup` (écouté sur l'élément <signature-pad>, pas sur document) il lit le canvas via toDataURL(),
// émet isEmpty / isComplete / drawEnd, et c'est ce toDataURL() qui sera envoyé comme signature.
// Il faut donc dessiner l'image PUIS déclencher un mouseup sur le canvas (il remonte jusqu'à <signature-pad>).
const notifySignaturePad = canvas => {
    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
};

// Fonction principale
const main = () => {

    // Le parent dans le quel on va injecter le modal et le bouton
    var container = document.getElementsByClassName('text center border-radius padding-xs white cursor-pointer')[0];

    // On injecte le bouton et le canvas...
    container.innerHTML += MODAL_TEXT;

    // Si le bouton "Parcourir mes fichiers" est cliqué
    document.getElementById('wtf-file-select').onclick = e => {
        e.stopPropagation();
        // On ouvre le selecteur de fichiers (input type="file" invisible
        document.getElementById('wtf-file-elem').click();
    }

    // Quand un fichier a été sélectionné
    document.getElementById('wtf-file-elem').onchange = e => {
        e.stopPropagation();
        // Si il n'y a bien qu'un seul fichier
        if (e.target.files.length == 1) {
            // On dessine la photo sélectionnée
            // data: URL et non blob: URL, sinon Firefox "salit" (taint) le canvas de la page : toDataURL()
            // lève alors SecurityError dans le composant, et "Valider" ne s'active plus jamais
            var reader = new FileReader();
            reader.onload = () => draw(reader.result);
            reader.readAsDataURL(e.target.files[0]);
        }
    }
    document.getElementById('wtf-file-elem').onclick = e => {
        e.stopPropagation();
    }

    var canvas = document.getElementsByTagName('canvas')[0];
    var context = canvas.getContext('2d');

    // DEBUG temporaire : état du bouton "Valider" après chaque mouseup (réel ou simulé)
    document.addEventListener('mouseup', () => setTimeout(() => {
        try { console.log('[SoWeSketch] mouseup -> taille dataURL :', canvas.toDataURL().length,
            '| bouton actif :', container.classList.contains('active-button'),
            '| canvas', canvas.width + 'x' + canvas.height); } catch (err) { console.log('[SoWeSketch] canvas souillé (taint) :', err.name); }
    }, 50), true);

    // Note: je ne sais pas pourquoi je change de langue

    const draw = url => {
        // Firefox : drawImage() d'une image créée par le content script souille le canvas pour la page
        // (son toDataURL() lève SecurityError, "Valider" reste grisé). Charger l'image côté page est bloqué
        // par la CSP. On dessine donc sur un canvas annexe, puis on copie les pixels avec putImageData(),
        // qui ne souille pas.
        var image = new Image();

        const onLoad = _e => {
            console.log('[SoWeSketch] image chargée :', image.width + 'x' + image.height);
            // Centers the image

            // Canvas dimensions
            var cw = canvas.offsetWidth;
            var ch = canvas.offsetHeight;

            // Image's dimensions
            var iw = image.width;
            var ih = image.height;

            // Canvas ratio
            var cr = cw / ch;
            // Image ratio
            var ir = iw / ih;

            // Ratio between the canvas and the image, used to scale the image
            var diffY = ch / ih;
            var diffX = cw / iw;

            var width, height, posX, posY;

            if (cr > ir) {
                // Image is taller than the canvas (when set to same size)
                // Move on the Y axis
                var padding = (ch / 2) - (ih * diffX / 2);
                height = ih * diffX;
                width = cw;
                posX = 0;
                posY = padding;
            } else {
                // Image is wider than the canvas (when set to same size)
                // Move on the X axis
                var padding = (cw / 2) - (iw * diffY / 2);
                width = iw * diffY;
                height = ch;
                posX = padding;
                posY = 0;
            }

            // Réaffecter width vide le canvas ET lève un éventuel taint (clearRect ne le fait pas)
            canvas.width = canvas.width;

            // Dessine l'image sur un canvas annexe, puis copie les pixels sur celui de la page
            var scratch = document.createElement('canvas');
            scratch.width = canvas.width;
            scratch.height = canvas.height;
            var scratchContext = scratch.getContext('2d');
            scratchContext.drawImage(image, posX, posY, width, height);
            context.putImageData(scratchContext.getImageData(0, 0, scratch.width, scratch.height), 0, 0);

            // Dit au composant qu'une signature existe (active le bouton "Valider")
            notifySignaturePad(canvas);
        };

        image.onload = onLoad;
        image.onerror = () => console.log('[SoWeSketch] image illisible');
        image.src = url;
    }

    // AutoSign : le popup a rempli le code puis posé un drapeau, on charge la signature enregistrée
    // et on laisse l'utilisateur cliquer sur "Valider"
    browser.storage.local.get(['signature', 'autoSignAt']).then(({ signature, autoSignAt }) => {
        console.log('[SoWeSketch] AutoSign : drapeau =', autoSignAt ? Math.round((Date.now() - autoSignAt) / 1000) + ' s' : 'absent',
            '| signature enregistrée =', !!signature);
        if (!autoSignAt) {
            return;
        }
        browser.storage.local.remove('autoSignAt');
        if (signature && Date.now() - autoSignAt < AUTOSIGN_MAX_AGE) {
            // Le compte à rebours de 3 s a lieu sur la page du code, avant la navigation : ici le canvas existe déjà,
            // mais le composant redimensionne (et vide) son canvas dans ngAfterViewInit, de façon asynchrone.
            // On attend donc que canvas.width == offsetWidth avant de dessiner
            let tries = 0;
            const timer = setInterval(() => {
                const ready = canvas.offsetWidth > 0 && canvas.width === canvas.offsetWidth;
                if (ready || ++tries > AUTOSIGN_WAIT_TRIES) {
                    clearInterval(timer);
                    console.log('[SoWeSketch] AutoSign : canvas prêt =', ready, '| essais =', tries,
                        '| width/offsetWidth =', canvas.width + '/' + canvas.offsetWidth);
                    if (ready) {
                        setTimeout(() => draw(signature), 200);
                    }
                }
            }, 250);
        }
    });
}
