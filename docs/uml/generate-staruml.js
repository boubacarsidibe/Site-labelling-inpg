const fs = require('fs');
const path = require('path');

let counter = 0;
const nextId = () => Buffer.from(`label-inpg-${String(++counter).padStart(5, '0')}`).toString('base64');
const ref = element => ({ $ref: element._id });

function element(type, parent, properties = {}) {
  return {
    _type: type,
    _id: nextId(),
    ...(parent ? { _parent: ref(parent) } : {}),
    ...properties,
  };
}

function addOwned(parent, child) {
  parent.ownedElements ??= [];
  parent.ownedElements.push(child);
  return child;
}

function addView(diagram, view) {
  diagram.ownedViews ??= [];
  diagram.ownedViews.push(view);
  return view;
}

function hiddenLabel(parent, model, properties = {}) {
  return element('LabelView', parent, {
    ...(model ? { model: ref(model) } : {}),
    visible: false,
    font: 'Arial;13;0',
    height: 13,
    ...properties,
  });
}

function visibleLabel(parent, model, text, properties = {}) {
  return element('LabelView', parent, {
    ...(model ? { model: ref(model) } : {}),
    font: 'Arial;13;0',
    height: 13,
    text,
    ...properties,
  });
}

function makeNameCompartment(view, model, name, rect, options = {}) {
  const compartment = element('UMLNameCompartmentView', view, {
    model: ref(model),
    subViews: [],
    font: 'Arial;13;0',
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  });
  const stereotype = options.stereotype
    ? visibleLabel(compartment, model, `«${options.stereotype}»`, {
        left: rect.left + 5,
        top: rect.top + 4,
        width: rect.width - 10,
        font: 'Arial;13;0',
        horizontalAlignment: 2,
      })
    : hiddenLabel(compartment, model);
  const nameTop = rect.top + (options.stereotype ? 19 : Math.max(5, Math.floor((rect.height - 13) / 2)));
  const nameLabel = visibleLabel(compartment, model, name, {
    left: rect.left + 5,
    top: nameTop,
    width: rect.width - 10,
    height: options.nameHeight ?? 13,
    font: 'Arial;13;1',
    horizontalAlignment: 2,
    wordWrap: true,
  });
  const namespace = hiddenLabel(compartment, model);
  const property = hiddenLabel(compartment, model, { horizontalAlignment: 1 });
  compartment.subViews.push(stereotype, nameLabel, namespace, property);
  compartment.stereotypeLabel = ref(stereotype);
  compartment.nameLabel = ref(nameLabel);
  compartment.namespaceLabel = ref(namespace);
  compartment.propertyLabel = ref(property);
  return compartment;
}

function makeTextView(diagram, text, left, top, width = 320, height = 24) {
  return addView(diagram, element('UMLTextView', diagram, {
    font: 'Arial;13;0',
    left,
    top,
    width,
    height,
    text,
    wordWrap: true,
  }));
}

function makeNamedView(diagram, model, type, left, top, width, height, options = {}) {
  const view = element(type, diagram, {
    model: ref(model),
    subViews: [],
    font: 'Arial;13;0',
    containerChangeable: true,
    left,
    top,
    width,
    height,
    ...(options.fillColor ? { fillColor: options.fillColor } : {}),
  });
  const nameHeight = options.nameHeight ?? Math.min(height, options.stereotype ? 42 : 28);
  const nameCompartment = makeNameCompartment(view, model, options.label ?? model.name ?? '', {
    left,
    top,
    width,
    height: nameHeight,
  }, options);
  view.subViews.push(nameCompartment);
  view.nameCompartment = ref(nameCompartment);
  if (type === 'UMLActorView' || type === 'UMLUseCaseView') {
    const compartments = [
      ['UMLAttributeCompartmentView', 'attributeCompartment'],
      ['UMLOperationCompartmentView', 'operationCompartment'],
      ['UMLReceptionCompartmentView', 'receptionCompartment'],
      ['UMLTemplateParameterCompartmentView', 'templateParameterCompartment'],
    ];
    if (type === 'UMLUseCaseView') compartments.push(['UMLExtensionPointCompartmentView', 'extensionPointCompartment']);
    for (const [compartmentType, property] of compartments) {
      const compartment = element(compartmentType, view, {
        model: ref(model), visible: false, font: 'Arial;13;0', left, top, width: 10, height: 10,
      });
      view.subViews.push(compartment);
      view[property] = ref(compartment);
    }
    view.suppressAttributes = true;
    view.suppressOperations = true;
  }
  if (options.wordWrap !== false) view.wordWrap = true;
  addView(diagram, view);
  return view;
}

function makeClassifierView(diagram, model, type, left, top, width, height, options = {}) {
  const view = makeNamedView(diagram, model, type, left, top, width, height, {
    ...options,
    nameHeight: options.stereotype ? 40 : 28,
  });
  const attributeTop = top + (options.stereotype ? 40 : 28);
  const attributeCompartment = element('UMLAttributeCompartmentView', view, {
    model: ref(model),
    subViews: [],
    font: 'Arial;12;0',
    left,
    top: attributeTop,
    width,
    height: Math.max(10, height - (attributeTop - top)),
    visible: options.showAttributes !== false,
  });
  for (const attribute of model.attributes ?? []) {
    const index = attributeCompartment.subViews.length;
    const attributeView = element('UMLAttributeView', attributeCompartment, {
      model: ref(attribute),
      font: 'Arial;12;0',
      left: left + 5,
      top: attributeTop + 5 + index * 15,
      width: width - 10,
      height: 13,
      text: `+ ${attribute.name}${attribute.type ? `: ${typeof attribute.type === 'string' ? attribute.type : 'ref'}` : ''}`,
    });
    attributeCompartment.subViews.push(attributeView);
  }
  const operationCompartment = element('UMLOperationCompartmentView', view, {
    model: ref(model), visible: false, font: 'Arial;13;0', width: 10, height: 10,
  });
  const receptionCompartment = element('UMLReceptionCompartmentView', view, {
    model: ref(model), visible: false, font: 'Arial;13;0', width: 10, height: 10,
  });
  const templateCompartment = element('UMLTemplateParameterCompartmentView', view, {
    model: ref(model), visible: false, font: 'Arial;13;0', width: 10, height: 10,
  });
  view.subViews.push(attributeCompartment, operationCompartment, receptionCompartment, templateCompartment);
  view.attributeCompartment = ref(attributeCompartment);
  view.operationCompartment = ref(operationCompartment);
  view.receptionCompartment = ref(receptionCompartment);
  view.templateParameterCompartment = ref(templateCompartment);
  view.suppressAttributes = options.showAttributes === false;
  view.suppressOperations = true;
  return view;
}

function edgeLabel(edgeView, model, text, left, top, visible = true, distance = 15, edgePosition = 1) {
  return element('EdgeLabelView', edgeView, {
    model: ref(model),
    visible,
    font: 'Arial;12;0',
    left,
    top,
    width: visible ? Math.max(25, text.length * 7) : 0,
    height: 13,
    alpha: Math.PI / 2,
    distance,
    hostEdge: ref(edgeView),
    edgePosition,
    ...(visible ? { text } : {}),
  });
}

function makeEdgeView(diagram, model, type, tailView, headView, points, options = {}) {
  const edge = element(type, diagram, {
    model: ref(model),
    subViews: [],
    font: 'Arial;12;0',
    head: ref(headView),
    tail: ref(tailView),
    lineStyle: options.lineStyle ?? 2,
    points,
    showVisibility: options.showVisibility ?? true,
  });
  const first = points.split(';')[0].split(':').map(Number);
  const last = points.split(';').at(-1).split(':').map(Number);
  const midX = Math.round((first[0] + last[0]) / 2);
  const midY = Math.round((first[1] + last[1]) / 2);
  const name = edgeLabel(edge, model, options.label ?? model.name ?? '', midX - 30, midY - 16, Boolean(options.label ?? model.name));
  const stereotype = edgeLabel(edge, model, options.stereotype ? `«${options.stereotype}»` : '', midX - 30, midY - 31, Boolean(options.stereotype), 30);
  const property = edgeLabel(edge, model, '', midX, midY + 5, false);
  edge.subViews.push(name, stereotype, property);
  edge.nameLabel = ref(name);
  edge.stereotypeLabel = ref(stereotype);
  edge.propertyLabel = ref(property);
  addView(diagram, edge);
  return edge;
}

function makeAssociation(modelParent, source, target, sourceMultiplicity = '', targetMultiplicity = '', name = '') {
  const association = element('UMLAssociation', modelParent, { name });
  association.end1 = element('UMLAssociationEnd', association, {
    reference: ref(source),
    ...(sourceMultiplicity ? { multiplicity: sourceMultiplicity } : {}),
  });
  association.end2 = element('UMLAssociationEnd', association, {
    reference: ref(target),
    ...(targetMultiplicity ? { multiplicity: targetMultiplicity } : {}),
  });
  addOwned(modelParent, association);
  return association;
}

function makeAssociationView(diagram, association, tailView, headView, points) {
  const edge = makeEdgeView(diagram, association, 'UMLAssociationView', tailView, headView, points, {
    label: '',
    lineStyle: 1,
    showVisibility: false,
  });
  const first = points.split(';')[0].split(':').map(Number);
  const last = points.split(';').at(-1).split(':').map(Number);
  const tailMultiplicity = edgeLabel(edge, association.end1, association.end1.multiplicity ?? '', first[0] + 5, first[1] - 18, Boolean(association.end1.multiplicity), 15, 0);
  const headMultiplicity = edgeLabel(edge, association.end2, association.end2.multiplicity ?? '', last[0] - 28, last[1] - 18, Boolean(association.end2.multiplicity), 15, 1);
  edge.subViews.push(tailMultiplicity, headMultiplicity);
  edge.tailMultiplicityLabel = ref(tailMultiplicity);
  edge.headMultiplicityLabel = ref(headMultiplicity);
  return edge;
}

function addAttribute(owner, name, type, options = {}) {
  owner.attributes ??= [];
  const attribute = element('UMLAttribute', owner, { name, type, ...options });
  owner.attributes.push(attribute);
  return attribute;
}

function center(view) {
  return { x: Math.round(view.left + view.width / 2), y: Math.round(view.top + view.height / 2) };
}

function orthogonalPoints(tailView, headView) {
  const tail = center(tailView);
  const head = center(headView);
  if (Math.abs(tail.x - head.x) < 30 || Math.abs(tail.y - head.y) < 30) return `${tail.x}:${tail.y};${head.x}:${head.y}`;
  const midX = Math.round((tail.x + head.x) / 2);
  return `${tail.x}:${tail.y};${midX}:${tail.y};${midX}:${head.y};${head.x}:${head.y}`;
}

// Tracé imposé : liste de points [x, y] du bord de la source au bord de la cible.
function routePoints(route) {
  return route.map(([x, y]) => `${x}:${y}`).join(';');
}

function selfLoopPoints(view) {
  const left = view.left + Math.round(view.width * 0.3);
  const right = view.left + Math.round(view.width * 0.7);
  const top = view.top - 40;
  return `${left}:${view.top};${left}:${top};${right}:${top};${right}:${view.top}`;
}

function boundaryPoints(tailView, headView) {
  const tail = center(tailView);
  const head = center(headView);
  const horizontal = Math.abs(tail.x - head.x) >= Math.abs(tail.y - head.y);
  if (horizontal) {
    const tailX = tail.x < head.x ? tailView.left + tailView.width : tailView.left;
    const headX = tail.x < head.x ? headView.left : headView.left + headView.width;
    return `${tailX}:${tail.y};${headX}:${head.y}`;
  }
  const tailY = tail.y < head.y ? tailView.top + tailView.height : tailView.top;
  const headY = tail.y < head.y ? headView.top : headView.top + headView.height;
  return `${tail.x}:${tailY};${head.x}:${headY}`;
}

function createUseCaseModel(project) {
  const model = addOwned(project, element('UMLModel', project, { name: '01 - Cas d’utilisation', ownedElements: [] }));
  const subject = addOwned(model, element('UMLUseCaseSubject', model, { name: 'Plateforme Label INPG' }));

  const actors = {};
  for (const name of ['Visiteur', 'Entreprise', 'Professionnel', 'Gestionnaire', 'Évaluateur', 'Auditeur', 'Décideur', 'Administrateur', 'Superutilisateur']) {
    actors[name] = addOwned(model, element('UMLActor', model, { name }));
  }

  const useCases = {};
  const names = [
    'Consulter le portail et les formations', 'Vérifier un certificat', 'S’inscrire / se connecter',
    'Gérer le profil d’organisation', 'Créer ou modifier un brouillon', 'Déposer les justificatifs',
    'Soumettre le dossier', 'Suivre le dossier et les notifications', 'Répondre aux corrections',
    'Consulter ou télécharger les certificats', 'S’inscrire à une formation', 'Valider les justificatifs',
    'Affecter un évaluateur', 'Planifier un audit', 'Réaliser l’évaluation', 'Réaliser l’audit',
    'Demander / valider une correction', 'Préparer le dossier pour décision', 'Rendre la décision',
    'Suspendre / réactiver / révoquer un certificat', 'Gérer formations, référentiels et utilisateurs',
    'Créer les comptes internes', 'Démarrer l’évaluation du dossier', 'Gérer le statut des inscriptions',
  ];
  for (const name of names) useCases[name] = addOwned(model, element('UMLUseCase', model, { name }));

  function actorLink(diagram, actor, useCase, actorView, useCaseView) {
    const association = makeAssociation(model, actor, useCase);
    makeAssociationView(diagram, association, actorView, useCaseView, boundaryPoints(actorView, useCaseView));
  }

  function useCaseDiagram(name, actorNames, useCaseNames, positions, options = {}) {
    const diagram = addOwned(model, element('UMLUseCaseDiagram', model, {
      name, ownedViews: [], defaultDiagram: options.isDefault ?? false,
    }));
    makeNamedView(diagram, subject, 'UMLUseCaseSubjectView', ...options.subject, { label: subject.name, wordWrap: false });
    const actorViews = {};
    for (const actorName of actorNames) {
      actorViews[actorName] = makeNamedView(diagram, actors[actorName], 'UMLActorView', ...positions.actors[actorName]);
    }
    const views = {};
    for (const useCaseName of useCaseNames) {
      views[useCaseName] = makeNamedView(diagram, useCases[useCaseName], 'UMLUseCaseView', ...positions.useCases[useCaseName], {
        label: useCaseName, nameHeight: positions.useCases[useCaseName][3] - 8,
      });
    }
    for (const [actorName, linkedNames] of Object.entries(options.links ?? {})) {
      for (const linkedName of linkedNames) {
        actorLink(diagram, actors[actorName], useCases[linkedName], actorViews[actorName], views[linkedName]);
      }
    }
    if (options.note) makeTextView(diagram, options.note, options.noteLeft ?? 290, options.noteTop, options.noteWidth ?? 700, 34);
    return { diagram, views };
  }

  useCaseDiagram('UC-01 - Portail public', ['Visiteur'], names.slice(0, 3), {
    actors: { Visiteur: [35, 165, 125, 95] },
    useCases: {
      [names[0]]: [340, 80, 330, 64],
      [names[1]]: [340, 205, 330, 64],
      [names[2]]: [340, 330, 330, 64],
    },
  }, {
    subject: [250, 35, 520, 430], isDefault: true,
    links: { Visiteur: names.slice(0, 3) },
    note: 'Accès public : catalogue, vérification du certificat et entrée dans l’authentification.',
    noteTop: 500, noteLeft: 245, noteWidth: 650,
  });

  const enterpriseNames = names.slice(2, 11);
  const enterprisePositions = {};
  enterpriseNames.forEach((name, index) => {
    enterprisePositions[name] = [390, 70 + index * 82, 350, 56];
  });
  const enterpriseDiagram = useCaseDiagram('UC-02 - Espace entreprise', ['Entreprise'], enterpriseNames, {
    actors: { Entreprise: [35, 365, 135, 100] },
    useCases: enterprisePositions,
  }, {
    subject: [270, 30, 600, 790],
    links: { Entreprise: enterpriseNames },
    note: 'L’entreprise agit uniquement sur son organisation et ses propres dossiers.',
    noteTop: 850, noteLeft: 290, noteWidth: 600,
  });
  const includeUpload = addOwned(model, element('UMLInclude', model, {
    source: ref(useCases['Soumettre le dossier']), target: ref(useCases['Déposer les justificatifs']),
  }));
  makeEdgeView(
    enterpriseDiagram.diagram,
    includeUpload,
    'UMLIncludeView',
    enterpriseDiagram.views['Soumettre le dossier'],
    enterpriseDiagram.views['Déposer les justificatifs'],
    boundaryPoints(enterpriseDiagram.views['Soumettre le dossier'], enterpriseDiagram.views['Déposer les justificatifs']),
    { stereotype: 'include', lineStyle: 1 },
  );

  useCaseDiagram('UC-03 - Espace professionnel', ['Professionnel'], [names[2], names[10]], {
    actors: { Professionnel: [35, 150, 145, 100] },
    useCases: {
      [names[2]]: [360, 90, 330, 64],
      [names[10]]: [360, 260, 330, 64],
    },
  }, {
    subject: [270, 35, 520, 360],
    links: { Professionnel: [names[2], names[10]] },
    note: 'Le professionnel s’authentifie puis consulte le catalogue et demande une inscription.',
    noteTop: 430, noteLeft: 250, noteWidth: 650,
  });

  const workflowNames = [...names.slice(11, 18), names[22]];
  useCaseDiagram('UC-04 - Instruction, évaluation et audit', ['Gestionnaire', 'Évaluateur', 'Auditeur'], workflowNames, {
    actors: {
      Gestionnaire: [25, 250, 145, 95],
      'Évaluateur': [1200, 140, 145, 95],
      Auditeur: [1200, 470, 145, 95],
    },
    useCases: {
      [names[11]]: [330, 75, 310, 60],
      [names[22]]: [330, 200, 310, 60],
      [names[12]]: [330, 325, 310, 60],
      [names[13]]: [330, 450, 310, 60],
      [names[14]]: [740, 75, 310, 60],
      [names[17]]: [740, 210, 310, 60],
      [names[16]]: [740, 375, 310, 60],
      [names[15]]: [740, 560, 310, 60],
    },
  }, {
    subject: [255, 30, 870, 640],
    links: {
      Gestionnaire: [names[11], names[22], names[12], names[13]],
      'Évaluateur': [names[14], names[16], names[17]],
      Auditeur: [names[15], names[16]],
    },
    note: 'Le gestionnaire planifie l’audit (audits.schedule) ; seul l’auditeur affecté le réalise (audits.perform).',
    noteTop: 710, noteLeft: 330, noteWidth: 720,
  });

  useCaseDiagram('UC-05 - Décision et cycle du certificat', ['Décideur', 'Superutilisateur'], [names[18], names[19]], {
    actors: { Décideur: [35, 90, 135, 100], Superutilisateur: [35, 290, 145, 100] },
    useCases: {
      [names[18]]: [360, 90, 360, 68],
      [names[19]]: [360, 260, 360, 68],
    },
  }, {
    subject: [270, 35, 570, 375],
    links: { Décideur: [names[18], names[19]], Superutilisateur: [names[18], names[19]] },
    note: 'decisions.make et certificates.manage : Décideur, et superutilisateur en secours. Le rôle ADMIN ne les possède pas.',
    noteTop: 445, noteLeft: 200, noteWidth: 760,
  });

  useCaseDiagram('UC-06 - Administration interne', ['Administrateur', 'Superutilisateur'], [names[20], names[23], names[21]], {
    actors: {
      Administrateur: [25, 120, 155, 100],
      Superutilisateur: [25, 380, 155, 100],
    },
    useCases: {
      [names[20]]: [390, 70, 390, 72],
      [names[23]]: [390, 205, 390, 72],
      [names[21]]: [390, 390, 390, 72],
    },
  }, {
    subject: [285, 35, 610, 500],
    links: {
      Administrateur: [names[20], names[23]],
      Superutilisateur: [names[21]],
    },
    note: 'Le superutilisateur hérite des droits ADMIN et seul il crée les comptes internes (administrators.create).',
    noteTop: 570, noteLeft: 240, noteWidth: 700,
  });

  // UC-00 : hiérarchie des acteurs, dérivée de access.CAPABILITIES et de access.role().
  const abstractActors = {
    authenticated: addOwned(model, element('UMLActor', model, { name: 'Utilisateur authentifié', isAbstract: true })),
    internal: addOwned(model, element('UMLActor', model, { name: 'Agent interne', isAbstract: true })),
  };
  const overview = addOwned(model, element('UMLUseCaseDiagram', model, { name: 'UC-00 - Acteurs et généralisations', ownedViews: [] }));
  const actorPositions = {
    Visiteur: [40, 60], authenticated: [420, 60], Entreprise: [140, 300], Professionnel: [360, 300], internal: [700, 300],
    Gestionnaire: [420, 540], 'Évaluateur': [590, 540], Auditeur: [760, 540], Décideur: [930, 540], Administrateur: [1100, 540],
    Superutilisateur: [1100, 760],
  };
  const overviewViews = {};
  for (const [key, [left, top]] of Object.entries(actorPositions)) {
    const actor = abstractActors[key] ?? actors[key];
    overviewViews[key] = makeNamedView(overview, actor, 'UMLActorView', left, top, 130, 100, { label: actor.name });
  }
  const generalizations = [
    ['Entreprise', 'authenticated'], ['Professionnel', 'authenticated'], ['internal', 'authenticated'],
    ['Gestionnaire', 'internal'], ['Évaluateur', 'internal'], ['Auditeur', 'internal'], ['Décideur', 'internal'],
    ['Administrateur', 'internal'], ['Superutilisateur', 'Administrateur'],
  ];
  for (const [child, parent] of generalizations) {
    const childActor = abstractActors[child] ?? actors[child];
    const parentActor = abstractActors[parent] ?? actors[parent];
    const generalization = addOwned(model, element('UMLGeneralization', model, { source: ref(childActor), target: ref(parentActor) }));
    makeEdgeView(overview, generalization, 'UMLGeneralizationView', overviewViews[child], overviewViews[parent], boundaryPoints(overviewViews[child], overviewViews[parent]), { label: '', lineStyle: 1, showVisibility: false });
  }
  makeTextView(overview, 'Rôles serveur : ENTERPRISE, PROFESSIONAL, MANAGER, EVALUATOR, AUDITOR, DECISION_MAKER, ADMIN. Un superutilisateur est résolu en ADMIN puis reçoit administrators.create, decisions.make et certificates.manage. Un compte ENTERPRISE sans organisation n’a aucun rôle.', 40, 900, 1150, 40);
  return model;
}

function createDataModel(project) {
  const model = addOwned(project, element('UMLModel', project, { name: '02 - Modèle de données', ownedElements: [] }));
  const classes = {};
  const definitions = {
    User: [['username', 'String'], ['email', 'String'], ['is_active', 'Boolean'], ['is_superuser', 'Boolean']],
    AccessProfile: [['role', 'Role']],
    Organization: [['legal_name', 'String'], ['ninea', 'String {unique}'], ['activity', 'String'], ['address', 'String']],
    Application: [['reference', 'String {unique}'], ['request_type', 'INITIAL | RENEWAL'], ['level', 'Standard | Gold | Platinum'], ['activity', 'Activity'], ['status', 'ApplicationStatus'], ['domains', 'JSON'], ['scope', 'String'], ['description', 'Text'], ['created_at', 'DateTime']],
    RequiredDocument: [['domain', 'Domain'], ['name', 'String'], ['mandatory', 'Boolean'], ['status', 'DocumentStatus'], ['file', 'File'], ['review_comment', 'Text'], ['submitted_at', 'DateTime'], ['reviewed_at', 'DateTime']],
    ApplicationAssignment: [],
    WorkflowEvent: [['event_type', 'String'], ['note', 'Text'], ['created_at', 'DateTime']],
    Audit: [['scheduled_for', 'DateTime'], ['performed_at', 'DateTime'], ['status', 'SCHEDULED | COMPLETED'], ['summary', 'Text']],
    NonConformity: [['reference', 'String'], ['domain', 'Domain'], ['description', 'Text'], ['severity', 'MINEURE | MAJEURE | CRITIQUE'], ['status', 'OPEN | CORRECTED | VALIDATED'], ['response', 'Text'], ['created_at', 'DateTime']],
    Certificate: [['number', 'String {unique}'], ['issued_at', 'DateTime'], ['expires_at', 'DateTime'], ['status', 'VALID | SUSPENDED | REVOKED'], ['effective_status', 'derived']],
    RequirementTemplate: [['domain', 'Domain'], ['activity', 'Activity'], ['name', 'String'], ['mandatory', 'Boolean'], ['active', 'Boolean'], ['version', 'String'], ['created_at', 'DateTime']],
    ApplicationMessage: [['body', 'Text'], ['created_at', 'DateTime']],
    Notification: [['title', 'String'], ['body', 'Text'], ['url', 'String'], ['read_at', 'DateTime'], ['created_at', 'DateTime']],
    Training: [['title', 'String'], ['description', 'Text'], ['duration_days', 'Integer'], ['format', 'IN_PERSON | ONLINE | HYBRID'], ['starts_at', 'DateTime'], ['capacity', 'Integer'], ['active', 'Boolean'], ['created_at', 'DateTime']],
    TrainingEnrollment: [['status', 'REQUESTED | CONFIRMED | COMPLETED | CANCELLED'], ['enrolled_at', 'DateTime']],
  };
  for (const [name, attributes] of Object.entries(definitions)) {
    const item = addOwned(model, element('UMLClass', model, { name, attributes: [] }));
    addAttribute(item, 'id', 'BigAutoField {PK}');
    for (const [attributeName, type] of attributes) addAttribute(item, attributeName, type);
    classes[name] = item;
    domainClasses[name] = item;
  }
  const relations = [
    ['User', 'AccessProfile', '1', '0..1', 'profil'], ['Organization', 'AccessProfile', '0..1', '0..*', 'rattachement'],
    ['Organization', 'Application', '1', '0..*', 'dossiers'], ['Application', 'RequiredDocument', '1', '0..*', 'documents'],
    ['Application', 'ApplicationAssignment', '1', '0..*', 'affectations'], ['User', 'ApplicationAssignment', '1', '0..*', 'assigné'],
    ['Application', 'WorkflowEvent', '1', '0..*', 'évènements'], ['User', 'WorkflowEvent', '0..1', '0..*', 'acteur'],
    ['Application', 'Audit', '1', '0..*', 'audits'], ['User', 'Audit', '1', '0..*', 'auditeur'],
    ['Application', 'NonConformity', '1', '0..*', 'non-conformités'], ['Application', 'Certificate', '1', '0..1', 'certificat'],
    ['Application', 'ApplicationMessage', '1', '0..*', 'messages'], ['User', 'ApplicationMessage', '0..1', '0..*', 'auteur'],
    ['User', 'Notification', '1', '0..*', 'destinataire'], ['Training', 'TrainingEnrollment', '1', '0..*', 'inscriptions'],
    ['User', 'TrainingEnrollment', '1', '0..*', 'participant'], ['Organization', 'TrainingEnrollment', '0..1', '0..*', 'organisation'],
  ];
  const associations = {};
  for (const [source, target, sourceMultiplicity, targetMultiplicity] of relations) {
    const association = makeAssociation(model, classes[source], classes[target], sourceMultiplicity, targetMultiplicity, '');
    associations[`${source}:${target}`] = association;
  }
  const templateDependency = addOwned(model, element('UMLDependency', model, {
    name: 'génère la checklist', source: ref(classes.RequirementTemplate), target: ref(classes.RequiredDocument),
  }));

  function renderClassDiagram(name, positions, relationKeys, note, options = {}) {
    const diagram = addOwned(model, element('UMLClassDiagram', model, { name, ownedViews: [], defaultDiagram: options.isDefault ?? false }));
    const views = {};
    for (const [className, position] of Object.entries(positions)) {
      views[className] = makeClassifierView(diagram, classes[className], 'UMLClassView', ...position, {
        fillColor: '#fffdf6',
        showAttributes: options.showAttributes !== false,
      });
    }
    for (const [source, target] of relationKeys) {
      const association = associations[`${source}:${target}`];
      makeAssociationView(diagram, association, views[source], views[target], boundaryPoints(views[source], views[target]));
    }
    if (views.RequirementTemplate && views.RequiredDocument) {
      makeEdgeView(diagram, templateDependency, 'UMLDependencyView', views.RequirementTemplate, views.RequiredDocument, boundaryPoints(views.RequirementTemplate, views.RequiredDocument), { label: 'génère la checklist', stereotype: 'derive', lineStyle: 1 });
    }
    const bottom = Math.max(...Object.values(positions).map(position => position[1] + position[3]));
    makeTextView(diagram, note, options.noteLeft ?? 250, bottom + 55, options.noteWidth ?? 850, 42);
    return diagram;
  }

  renderClassDiagram('DM-01 - Vue globale du domaine', {
    User: [40, 50, 190, 64], AccessProfile: [310, 50, 210, 64], Organization: [610, 50, 220, 64],
    Application: [500, 240, 260, 74], RequiredDocument: [900, 210, 235, 64],
    Audit: [900, 365, 215, 64], NonConformity: [560, 520, 245, 64], Certificate: [245, 520, 220, 64],
  }, [
    ['User', 'AccessProfile'], ['Organization', 'AccessProfile'], ['Organization', 'Application'],
    ['Application', 'RequiredDocument'], ['Application', 'Audit'], ['Application', 'NonConformity'], ['Application', 'Certificate'],
  ], 'Vue de synthèse volontairement légère. Les attributs et les relations secondaires sont détaillés dans DM-02 à DM-06.', {
    isDefault: true, showAttributes: false, noteLeft: 270, noteWidth: 720,
  });

  renderClassDiagram('DM-02 - Identités, rôles et affectations', {
    User: [45, 55, 225, 125], AccessProfile: [360, 65, 225, 85], Organization: [700, 45, 245, 125],
    ApplicationAssignment: [235, 330, 250, 70], Application: [620, 275, 310, 205],
  }, [
    ['User', 'AccessProfile'], ['Organization', 'AccessProfile'], ['Organization', 'Application'],
    ['User', 'ApplicationAssignment'], ['Application', 'ApplicationAssignment'],
  ], 'Contraintes : un profil au plus par utilisateur ; une affectation unique par couple dossier-utilisateur.', {
    noteLeft: 180, noteWidth: 850,
  });

  renderClassDiagram('DM-03 - Dossier, documents et traçabilité', {
    User: [40, 55, 220, 125], Organization: [350, 45, 240, 125], Application: [690, 35, 310, 205],
    WorkflowEvent: [40, 365, 235, 115], RequirementTemplate: [380, 330, 265, 160],
    RequiredDocument: [760, 325, 280, 190],
  }, [
    ['Organization', 'Application'], ['Application', 'WorkflowEvent'], ['User', 'WorkflowEvent'],
    ['Application', 'RequiredDocument'],
  ], 'La soumission et chaque transition créent un évènement ; le référentiel génère la checklist documentaire.', {
    noteLeft: 170, noteWidth: 900,
  });

  renderClassDiagram('DM-04 - Audit, corrections et certificat', {
    User: [45, 55, 220, 125], Application: [390, 35, 310, 205],
    Audit: [45, 360, 235, 125], NonConformity: [390, 335, 285, 160], Certificate: [800, 360, 250, 145],
  }, [
    ['Application', 'Audit'], ['User', 'Audit'], ['Application', 'NonConformity'], ['Application', 'Certificate'],
  ], 'Le statut EXPIRED est calculé ; le stockage persiste VALID, SUSPENDED ou REVOKED. Un dossier possède au plus un certificat.', {
    noteLeft: 120, noteWidth: 980,
  });

  renderClassDiagram('DM-05 - Messages et notifications', {
    User: [45, 45, 225, 125], Application: [650, 35, 310, 205],
    Notification: [45, 340, 245, 130], ApplicationMessage: [590, 350, 260, 100],
  }, [
    ['User', 'Notification'], ['User', 'ApplicationMessage'], ['Application', 'ApplicationMessage'],
  ], 'Les messages restent liés au dossier ; les notifications sont personnelles et peuvent pointer vers une URL interne.', {
    noteLeft: 170, noteWidth: 820,
  });

  renderClassDiagram('DM-06 - Formations et inscriptions', {
    User: [45, 45, 225, 125], Organization: [780, 45, 245, 125],
    TrainingEnrollment: [360, 330, 285, 100], Training: [780, 295, 270, 165],
  }, [
    ['User', 'TrainingEnrollment'], ['Organization', 'TrainingEnrollment'], ['Training', 'TrainingEnrollment'],
  ], 'Contrainte : une seule inscription par couple formation-utilisateur ; l’organisation est facultative.', {
    noteLeft: 170, noteWidth: 820,
  });
  return model;
}

function makeStateView(diagram, state, left, top, width = 180, height = 64) {
  const view = makeNamedView(diagram, state, 'UMLStateView', left, top, width, height, { fillColor: '#eef5ff' });
  for (const type of ['UMLInternalActivityCompartmentView', 'UMLInternalTransitionCompartmentView', 'UMLDecompositionCompartmentView']) {
    const compartment = element(type, view, { model: ref(state), visible: false, font: 'Arial;13;0', width: 10, height: 10 });
    view.subViews.push(compartment);
    if (type === 'UMLInternalActivityCompartmentView') view.internalActivityCompartment = ref(compartment);
    if (type === 'UMLInternalTransitionCompartmentView') view.internalTransitionCompartment = ref(compartment);
    if (type === 'UMLDecompositionCompartmentView') view.decompositionCompartment = ref(compartment);
  }
  return view;
}

function makeControlStateView(diagram, state, type, left, top, size = 24) {
  return addView(diagram, element(type, diagram, {
    model: ref(state), font: 'Arial;13;0', containerChangeable: true, left, top, width: size, height: size,
  }));
}

function createStateMachine(model, name, statesDefinition, transitionsDefinition, positions) {
  const machine = addOwned(model, element('UMLStateMachine', model, { name, ownedElements: [], regions: [] }));
  const region = element('UMLRegion', machine, { name: 'Région principale', vertices: [], transitions: [] });
  machine.regions.push(region);
  const diagram = addOwned(machine, element('UMLStatechartDiagram', machine, { name, ownedViews: [] }));
  const vertices = {};
  const views = {};
  for (const definition of statesDefinition) {
    const [key, label, type = 'UMLState'] = definition;
    const vertex = element(type, region, type === 'UMLState' ? { name: label } : type === 'UMLPseudostate' ? { kind: 'initial' } : {});
    region.vertices.push(vertex);
    vertices[key] = vertex;
    const [left, top, width = 180, height = 64] = positions[key];
    views[key] = type === 'UMLState'
      ? makeStateView(diagram, vertex, left, top, width, height)
      : makeControlStateView(diagram, vertex, type === 'UMLPseudostate' ? 'UMLPseudostateView' : 'UMLFinalStateView', left, top, width);
  }
  for (const [source, target, label, route] of transitionsDefinition) {
    const transition = element('UMLTransition', region, { name: label, source: ref(vertices[source]), target: ref(vertices[target]) });
    region.transitions.push(transition);
    const points = route ? routePoints(route) : source === target ? selfLoopPoints(views[source]) : orthogonalPoints(views[source], views[target]);
    makeEdgeView(diagram, transition, 'UMLTransitionView', views[source], views[target], points, { label });
  }
  return { machine, diagram };
}

function createStateModels(project) {
  const model = addOwned(project, element('UMLModel', project, { name: '03 - Cycles de vie', ownedElements: [] }));
  const dossier = createStateMachine(model, 'SM-01 - Cycle de vie du dossier', [
    ['initial', '', 'UMLPseudostate'], ['draft', 'DRAFT'], ['submitted', 'SUBMITTED'], ['review', 'UNDER_REVIEW'],
    ['correction', 'CORRECTION_REQUIRED'], ['decision', 'DECISION_PENDING'], ['certified', 'CERTIFIED'], ['rejected', 'REJECTED'],
    ['finalCertified', '', 'UMLFinalState'], ['finalRejected', '', 'UMLFinalState'],
  ], [
    ['initial', 'draft', 'création'], ['draft', 'draft', 'modifier / déposer'], ['draft', 'submitted', 'soumettre [pièces déposées]'],
    ['submitted', 'review', 'start-review [pièces validées]'],
    ['submitted', 'correction', 'pièce rejetée', [[500, 234], [500, 430]]],
    ['correction', 'submitted', 're-soumettre [NC validées]', [[650, 430], [650, 234]]],
    ['review', 'correction', 'request-correction / pièce rejetée', [[1160, 234], [1160, 462], [1120, 462]]],
    ['correction', 'review', 'dernière NC validée', [[1010, 430], [1010, 234]]],
    ['review', 'decision', 'complete-evaluation [tout validé]'],
    ['decision', 'certified', 'décision favorable'], ['decision', 'rejected', 'décision défavorable'],
    ['certified', 'finalCertified', 'clôture'], ['rejected', 'finalRejected', 'clôture'],
  ], {
    initial: [35, 190, 24, 24], draft: [100, 170, 165, 64], submitted: [480, 170, 190, 64], review: [980, 170, 200, 64],
    correction: [460, 430, 660, 64], decision: [1440, 170, 220, 64], certified: [1780, 80, 180, 64], rejected: [1780, 260, 180, 64],
    finalCertified: [2040, 98, 26, 26], finalRejected: [2040, 278, 26, 26],
  });
  makeTextView(dossier.diagram, 'Chaque transition sensible est contrôlée côté serveur et journalisée dans WorkflowEvent. Le dépôt n’est ouvert qu’en DRAFT et CORRECTION_REQUIRED.', 460, 560, 900, 32);

  const certificate = createStateMachine(model, 'SM-02 - Cycle de vie du certificat', [
    ['initial', '', 'UMLPseudostate'], ['valid', 'VALID'], ['suspended', 'SUSPENDED'], ['revoked', 'REVOKED'], ['expired', 'EXPIRED (dérivé)'],
    ['finalRevoked', '', 'UMLFinalState'], ['finalExpired', '', 'UMLFinalState'],
  ], [
    ['initial', 'valid', 'émission'], ['valid', 'suspended', 'suspendre'], ['suspended', 'valid', 'réactiver [non expiré]'],
    ['valid', 'revoked', 'révoquer'], ['suspended', 'revoked', 'révoquer'], ['valid', 'expired', 'expires_at atteint'],
    ['suspended', 'expired', 'expires_at atteint'], ['revoked', 'finalRevoked', 'terminal'], ['expired', 'finalExpired', 'renouvellement requis'],
  ], {
    initial: [35, 180, 24, 24], valid: [110, 160, 180, 64], suspended: [385, 160, 190, 64], revoked: [680, 65, 180, 64],
    expired: [680, 260, 210, 64], finalRevoked: [950, 83, 26, 26], finalExpired: [950, 278, 26, 26],
  });
  makeTextView(certificate.diagram, 'EXPIRED n’est pas stocké : il est calculé quand expires_at est atteint et interdit la réactivation.', 250, 390, 650, 32);

  const document = createStateMachine(model, 'SM-03 - Cycle de vie d’une pièce justificative', [
    ['initial', '', 'UMLPseudostate'], ['missing', 'MISSING (non déposé)'], ['submitted', 'SUBMITTED (déposé)'],
    ['validated', 'VALIDATED'], ['rejected', 'REJECTED (à corriger)'], ['final', '', 'UMLFinalState'],
  ], [
    ['initial', 'missing', 'checklist générée'], ['missing', 'submitted', 'upload [dépôt ouvert]'],
    ['submitted', 'submitted', 'nouveau dépôt'],
    ['submitted', 'validated', 'review VALIDATED', [[840, 180], [1000, 180], [1000, 92], [1150, 92]]],
    ['submitted', 'rejected', 'review REJECTED + commentaire', [[790, 229], [790, 332], [1150, 332]]],
    ['rejected', 'submitted', 'redéposer', [[1260, 364], [1260, 420], [680, 420], [680, 229]]],
    ['validated', 'final', 'décision du dossier'],
  ], {
    initial: [35, 185, 24, 24], missing: [220, 165, 200, 64], submitted: [620, 165, 220, 64], validated: [1150, 60, 190, 64],
    rejected: [1150, 300, 220, 64], final: [1560, 79, 26, 26],
  });
  makeTextView(document.diagram, 'Un rejet pendant SUBMITTED ou UNDER_REVIEW fait passer le dossier en CORRECTION_REQUIRED. Contrôles au dépôt : PDF / PNG / JPEG, 10 Mo, signature binaire, quota de l’organisation.', 150, 490, 850, 40);

  const nonConformity = createStateMachine(model, 'SM-04 - Cycle de vie d’une non-conformité', [
    ['initial', '', 'UMLPseudostate'], ['open', 'OPEN (ouverte)'], ['corrected', 'CORRECTED (corrigée)'], ['validated', 'VALIDATED (clôturée)'], ['final', '', 'UMLFinalState'],
  ], [
    ['initial', 'open', 'request-correction [dossier UNDER_REVIEW]'], ['open', 'corrected', 'respond-correction [réponse non vide]'],
    ['corrected', 'validated', 'validate-correction'], ['validated', 'final', ''],
  ], {
    initial: [35, 125, 24, 24], open: [380, 105, 190, 64], corrected: [860, 105, 210, 64], validated: [1260, 105, 210, 64], final: [1560, 123, 26, 26],
  });
  makeTextView(nonConformity.diagram, 'Référence NC-{dossier}-{n}, unique par dossier. Gravité : MINEURE, MAJEURE ou CRITIQUE. Quand la dernière NC est validée, le dossier revient en UNDER_REVIEW.', 120, 260, 900, 40);

  const audit = createStateMachine(model, 'SM-05 - Cycle de vie d’un audit', [
    ['initial', '', 'UMLPseudostate'], ['scheduled', 'SCHEDULED (planifié)'], ['completed', 'COMPLETED (réalisé)'], ['final', '', 'UMLFinalState'],
  ], [
    ['initial', 'scheduled', 'schedule-audit [UNDER_REVIEW, AUDITOR actif, date future]'], ['scheduled', 'completed', 'complete-audit [auditeur affecté] / performed_at, summary'],
    ['completed', 'final', ''],
  ], {
    initial: [35, 125, 24, 24], scheduled: [520, 105, 220, 64], completed: [1150, 105, 220, 64], final: [1480, 123, 26, 26],
  });
  makeTextView(audit.diagram, 'La planification crée aussi l’ApplicationAssignment de l’auditeur, ce qui lui ouvre l’accès au dossier.', 200, 260, 800, 32);

  const enrollment = createStateMachine(model, 'SM-06 - Cycle de vie d’une inscription à une formation', [
    ['initial', '', 'UMLPseudostate'], ['requested', 'REQUESTED'], ['confirmed', 'CONFIRMED'], ['completed', 'COMPLETED'], ['cancelled', 'CANCELLED'], ['final', '', 'UMLFinalState'],
  ], [
    ['initial', 'requested', 'enroll [places disponibles]'], ['requested', 'confirmed', 'confirmer (trainings.manage)'],
    ['requested', 'cancelled', 'annuler', [[350, 169], [350, 362], [640, 362]]],
    ['confirmed', 'completed', 'terminer'], ['confirmed', 'cancelled', 'annuler'],
    ['cancelled', 'requested', 'réinscription / enroll', [[730, 394], [730, 450], [190, 450], [190, 155], [260, 155]]],
    ['completed', 'final', ''],
  ], {
    initial: [35, 125, 24, 24], requested: [260, 105, 180, 64], confirmed: [640, 105, 180, 64], completed: [1050, 105, 180, 64],
    cancelled: [640, 330, 180, 64], final: [1350, 123, 26, 26],
  });
  makeTextView(enrollment.diagram, 'Capacité : REQUESTED, CONFIRMED et COMPLETED occupent une place. Une seule inscription par couple formation-utilisateur.', 150, 520, 850, 32);
  return model;
}

const CONTROL_NODE_TYPES = {
  initial: 'UMLInitialNode', final: 'UMLActivityFinalNode', flowFinal: 'UMLFlowFinalNode',
  decision: 'UMLDecisionNode', merge: 'UMLMergeNode', fork: 'UMLForkNode', join: 'UMLJoinNode',
};

function createActivity(model, name, laneNames, nodeDefinitions, flowDefinitions, options = {}) {
  const activity = addOwned(model, element('UMLActivity', model, { name: options.activityName ?? name, ownedElements: [], nodes: [], edges: [], groups: [] }));
  const diagram = addOwned(activity, element('UMLActivityDiagram', activity, { name, ownedViews: [] }));
  const laneWidth = options.laneWidth ?? 300;
  const bottom = Math.max(...nodeDefinitions.map(([, , , , top, , , height]) => top + (height ?? 56)));
  const lanes = {};
  const laneViews = {};
  laneNames.forEach((laneName, index) => {
    const partition = element('UMLActivityPartition', activity, { name: laneName, nodes: [] });
    activity.groups.push(partition);
    lanes[laneName] = partition;
    const left = 30 + index * (laneWidth + 20);
    const view = element('UMLSwimlaneView', diagram, {
      model: ref(partition), subViews: [], containedViews: [], font: 'Arial;13;0',
      left, top: 30, width: laneWidth, height: bottom + 40,
    });
    const label = visibleLabel(view, partition, laneName, { left: left + 5, top: 38, width: laneWidth - 10, font: 'Arial;13;1', horizontalAlignment: 2 });
    view.subViews.push(label);
    view.nameLabel = ref(label);
    addView(diagram, view);
    laneViews[laneName] = view;
  });
  const nodes = {};
  const views = {};
  for (const [key, label, laneName, left, top, kind = 'action', width, height] of nodeDefinitions) {
    const owner = laneName ? lanes[laneName] : activity;
    const type = CONTROL_NODE_TYPES[kind] ?? 'UMLAction';
    const item = element(type, owner, type === 'UMLAction' ? { name: label } : { name: label || key });
    if (laneName) owner.nodes.push(item); else activity.nodes.push(item);
    let view;
    if (type === 'UMLAction') {
      view = makeNamedView(diagram, item, 'UMLActionView', left, top, width ?? 220, height ?? 56, { label, nameHeight: height ?? 56, fillColor: '#f6fbff' });
    } else {
      const isBar = kind === 'fork' || kind === 'join';
      view = addView(diagram, element('UMLControlNodeView', diagram, {
        model: ref(item), font: 'Arial;13;0', containerChangeable: true, left, top,
        width: width ?? (isBar ? 160 : 26), height: height ?? (isBar ? 8 : 26),
      }));
    }
    if (laneName) {
      view.containerView = ref(laneViews[laneName]);
      laneViews[laneName].containedViews.push(ref(view));
    }
    nodes[key] = item;
    views[key] = view;
  }
  for (const [source, target, guard = '', route] of flowDefinitions) {
    const flowItem = element('UMLControlFlow', activity, { source: ref(nodes[source]), target: ref(nodes[target]), ...(guard ? { guard } : {}) });
    activity.edges.push(flowItem);
    makeEdgeView(diagram, flowItem, 'UMLControlFlowView', views[source], views[target], route ? routePoints(route) : orthogonalPoints(views[source], views[target]), { label: guard ? `[${guard}]` : '' });
  }
  if (options.note) makeTextView(diagram, options.note, 40, bottom + 100, options.noteWidth ?? 900, 40);
  return { activity, diagram };
}

function createActivityModel(project) {
  const model = addOwned(project, element('UMLModel', project, { name: '04 - Activités', ownedElements: [] }));
  // Couloirs de 340 px espacés de 360 px ; une action de 220 px commence à couloir + 40 et a son centre à couloir + 150.
  const E = 70, G = 430, R = 790, D = 1150;
  createActivity(model, 'ACT-01 - Processus complet de labellisation', ['Entreprise', 'Gestionnaire', 'Évaluateur / Auditeur', 'Décideur'], [
    ['initial', '', 'Entreprise', E + 97, 75, 'initial'],
    ['draft', 'Créer le brouillon (checklist générée)', 'Entreprise', E, 125],
    ['upload', 'Déposer les pièces obligatoires', 'Entreprise', E, 215],
    ['submit', 'Soumettre le dossier', 'Entreprise', E, 305],
    ['reviewDocs', 'Contrôler chaque pièce déposée', 'Gestionnaire', G, 395],
    ['docsOk', '', 'Gestionnaire', G + 97, 485, 'decision'],
    ['fixDocs', 'Redéposer la pièce rejetée', 'Entreprise', E, 470],
    ['startReview', 'Démarrer l’évaluation', 'Gestionnaire', G, 560],
    ['assign', 'Affecter l’évaluateur et planifier l’audit', 'Gestionnaire', G, 650],
    ['evaluate', 'Évaluer le dossier et réaliser l’audit', 'Évaluateur / Auditeur', R, 740],
    ['ncDecision', '', 'Évaluateur / Auditeur', R + 97, 830, 'decision'],
    ['requestNc', 'Ouvrir une non-conformité', 'Évaluateur / Auditeur', R, 905],
    ['answerNc', 'Répondre à la non-conformité', 'Entreprise', E, 905],
    ['validateNc', 'Valider la correction', 'Évaluateur / Auditeur', R, 995],
    ['prepare', 'Terminer l’évaluation', 'Évaluateur / Auditeur', R, 1085],
    ['decide', 'Rendre la décision', 'Décideur', D, 1085],
    ['decisionKind', '', 'Décideur', D + 97, 1175, 'decision'],
    ['issue', 'Émettre le certificat (3 ans)', 'Décideur', D, 1240],
    ['reject', 'Clore le dossier REJECTED', 'Décideur', D, 1330],
    ['final', '', 'Décideur', D + 97, 1420, 'final'],
  ], [
    ['initial', 'draft'], ['draft', 'upload'], ['upload', 'submit'], ['submit', 'reviewDocs'], ['reviewDocs', 'docsOk'],
    ['docsOk', 'fixDocs', 'pièce rejetée'], ['fixDocs', 'submit', 're-soumettre'], ['docsOk', 'startReview', 'toutes validées'],
    ['startReview', 'assign'], ['assign', 'evaluate'], ['evaluate', 'ncDecision'], ['ncDecision', 'requestNc', 'écart constaté'],
    ['requestNc', 'answerNc'],
    ['answerNc', 'validateNc', '', [[180, 961], [180, 1013], [790, 1013]]],
    ['validateNc', 'evaluate', '', [[790, 1037], [770, 1037], [770, 768], [790, 768]]],
    ['ncDecision', 'prepare', 'conforme', [[913, 843], [1050, 843], [1050, 1065], [960, 1065], [960, 1085]]],
    ['prepare', 'decide'], ['decide', 'decisionKind'], ['decisionKind', 'issue', 'CERTIFIED'],
    ['decisionKind', 'reject', 'REJECTED', [[1273, 1188], [1420, 1188], [1420, 1358], [1370, 1358]]],
    ['issue', 'final', '', [[1150, 1268], [1130, 1268], [1130, 1433], [1247, 1433]]], ['reject', 'final'],
  ], {
    activityName: 'Processus de labellisation', laneWidth: 340,
    note: 'Ordre réel du code : dépôt → soumission → contrôle documentaire → start-review → affectation / audit → corrections → complete-evaluation → decide.',
  });

  const toError = y => [[477, y], [290, y]];
  createActivity(model, 'ACT-02 - Inscription publique d’un compte', ['Visiteur', 'Plateforme (registration.register)'], [
    ['initial', '', 'Visiteur', 167, 75, 'initial'],
    ['choose', 'Choisir Entreprise ou Professionnel', 'Visiteur', 70, 125],
    ['fill', 'Saisir identité, e-mail et mot de passe (+ raison sociale et NINEA)', 'Visiteur', 70, 215, 'action', 220, 70],
    ['throttle', '', 'Plateforme (registration.register)', 477, 325, 'decision'],
    ['validate', 'Valider champs, e-mail, identifiant et robustesse du mot de passe', 'Plateforme (registration.register)', 390, 395, 'action', 220, 70],
    ['valid', '', 'Plateforme (registration.register)', 477, 500, 'decision'],
    ['create', 'Transaction : créer User, Organization (Entreprise) et AccessProfile', 'Plateforme (registration.register)', 390, 570, 'action', 220, 70],
    ['unique', '', 'Plateforme (registration.register)', 477, 675, 'decision'],
    ['ok', 'Répondre 201 « Compte créé »', 'Plateforme (registration.register)', 390, 760],
    ['error', 'Afficher l’erreur (400 / 429) et corriger la saisie', 'Visiteur', 70, 320, 'action', 220, 400],
    ['login', 'Se connecter', 'Visiteur', 70, 850],
    ['final', '', 'Visiteur', 167, 945, 'final'],
  ], [
    ['initial', 'choose'], ['choose', 'fill'], ['fill', 'throttle', '', [[290, 250], [490, 250], [490, 325]]], ['throttle', 'validate', 'quota respecté'], ['throttle', 'error', 'trop de tentatives', toError(338)],
    ['validate', 'valid'], ['valid', 'create', 'valide'], ['valid', 'error', 'invalide', toError(513)], ['create', 'unique'],
    ['unique', 'ok', 'identifiant et NINEA libres'], ['unique', 'error', 'IntegrityError', toError(688)], ['error', 'fill'], ['ok', 'login'], ['login', 'final'],
  ], {
    laneWidth: 300,
    note: 'Une inscription publique ne rattache jamais un compte à une organisation existante par NINEA. Mot de passe : 10 caractères minimum, non courant, non numérique, différent de l’identité.',
  });

  const toRight = (y, x = 480) => [[183, y], [x, y]];
  createActivity(model, 'ACT-03 - Dépôt sécurisé d’un justificatif', [], [
    ['initial', '', null, 157, 40, 'initial'],
    ['select', 'Sélectionner le fichier pour une pièce', null, 60, 90],
    ['status', '', null, 157, 180, 'decision'],
    ['size', '', null, 157, 260, 'decision'],
    ['type', '', null, 157, 340, 'decision'],
    ['signature', '', null, 157, 420, 'decision'],
    ['integrity', 'Vérifier %%EOF (PDF) ou Image.verify (PNG / JPEG)', null, 60, 490, 'action', 220, 64],
    ['quota', '', null, 157, 590, 'decision'],
    ['store', 'Enregistrer le fichier, status SUBMITTED, submitted_at', null, 60, 660, 'action', 220, 64],
    ['cleanup', 'Supprimer l’ancien fichier remplacé', null, 60, 760],
    ['event', 'Créer WorkflowEvent DOCUMENT_UPLOADED', null, 60, 850],
    ['final', '', null, 157, 940, 'final'],
    ['refuse', 'Refuser le dépôt (400 + message)', null, 480, 150, 'action', 240, 480],
    ['refused', '', null, 587, 690, 'flowFinal'],
  ], [
    ['initial', 'select'], ['select', 'status'], ['status', 'size', 'DRAFT ou CORRECTION_REQUIRED'], ['status', 'refuse', 'dépôt fermé', toRight(193)],
    ['size', 'type', '≤ 10 Mo'], ['size', 'refuse', '> 10 Mo', toRight(273)], ['type', 'signature', 'PDF / PNG / JPEG'], ['type', 'refuse', 'type ou extension refusé', toRight(353)],
    ['signature', 'integrity', 'en-tête conforme'], ['signature', 'refuse', 'contenu ≠ type déclaré', toRight(433)], ['integrity', 'quota'],
    ['quota', 'store', 'quota respecté'], ['quota', 'refuse', 'quota dépassé', toRight(603)], ['store', 'cleanup'], ['cleanup', 'event'], ['event', 'final'],
    ['refuse', 'refused'],
  ], {
    note: 'RequiredDocumentViewSet.upload : capacité documents.upload et périmètre de l’organisation vérifiés avant ces contrôles.', noteWidth: 800,
  });

  createActivity(model, 'ACT-04 - Autorisation d’une requête API', [], [
    ['initial', '', null, 157, 40, 'initial'],
    ['receive', 'Recevoir la requête /api/v1', null, 60, 90],
    ['authenticated', '', null, 157, 180, 'decision'],
    ['resolve', 'Résoudre le rôle : superuser → ADMIN, sinon AccessProfile.role', null, 60, 245, 'action', 220, 64],
    ['capability', '', null, 157, 345, 'decision'],
    ['scope', 'Filtrer le queryset : organisation, affectation ou accès global', null, 60, 410, 'action', 220, 64],
    ['found', '', null, 157, 510, 'decision'],
    ['state', '', null, 157, 580, 'decision'],
    ['execute', 'Exécuter l’action, journaliser et notifier', null, 60, 645],
    ['final', '', null, 157, 740, 'final'],
    ['deny', 'Répondre 403', null, 480, 160, 'action', 220, 220],
    ['missing', 'Répondre 404', null, 480, 500, 'action', 220, 46],
    ['invalid', 'Répondre 400 (transition refusée)', null, 480, 570, 'action', 220, 46],
    ['end', '', null, 800, 445, 'flowFinal'],
  ], [
    ['initial', 'receive'], ['receive', 'authenticated'], ['authenticated', 'resolve', 'session valide'], ['authenticated', 'deny', 'anonyme', toRight(193)],
    ['resolve', 'capability'], ['capability', 'scope', 'capacité présente'], ['capability', 'deny', 'capacité absente', toRight(358)],
    ['scope', 'found'], ['found', 'state', 'dans le périmètre'], ['found', 'missing', 'hors périmètre', toRight(523)],
    ['state', 'execute', 'état source autorisé'], ['state', 'invalid', 'état incompatible', toRight(593)], ['execute', 'final'],
    ['deny', 'end'], ['missing', 'end'], ['invalid', 'end'],
  ], {
    note: 'CapabilityPermission lit view.action_capabilities[view.action] ; get_queryset applique le périmètre ; chaque action métier vérifie l’état source.', noteWidth: 800,
  });
  return model;
}

function makeSequenceLifeline(diagram, interaction, collaboration, classifier, label, left, top, height, stereotype = '') {
  const represent = element('UMLAttribute', collaboration, { name: label, type: ref(classifier) });
  collaboration.attributes ??= [];
  collaboration.attributes.push(represent);
  const lifeline = element('UMLLifeline', interaction, { represent: ref(represent), isMultiInstance: false, ...(stereotype ? { stereotype } : {}) });
  interaction.participants.push(lifeline);
  const view = element('UMLSeqLifelineView', diagram, {
    model: ref(lifeline), subViews: [], font: 'Arial;13;0', left, top, width: 135, height,
  });
  const nameCompartment = makeNameCompartment(view, lifeline, label, { left, top, width: 135, height: 42 }, { stereotype, nameHeight: 18 });
  const linePart = element('UMLLinePartView', view, {
    model: ref(lifeline), font: 'Arial;13;0', left: left + 67, top: top + 42, width: 1, height: height - 42,
  });
  view.subViews.push(nameCompartment, linePart);
  view.nameCompartment = ref(nameCompartment);
  view.linePart = ref(linePart);
  addView(diagram, view);
  return { lifeline, view, linePart };
}

function makeSequenceMessage(diagram, interaction, source, target, label, y, options = {}) {
  const message = element('UMLMessage', interaction, {
    name: label, source: ref(source.lifeline), target: ref(target.lifeline), ...(options.reply ? { messageSort: 'reply' } : {}),
  });
  interaction.messages.push(message);
  const isSelfMessage = source === target;
  const messagePoints = isSelfMessage
    ? `${source.linePart.left}:${y};${source.linePart.left + 58}:${y};${source.linePart.left + 58}:${y + 24};${source.linePart.left}:${y + 24}`
    : `${source.linePart.left}:${y};${target.linePart.left}:${y}`;
  const edge = element('UMLSeqMessageView', diagram, {
    model: ref(message), subViews: [], font: 'Arial;12;0',
    head: ref(target.linePart), tail: ref(source.linePart),
    points: messagePoints,
  });
  const left = isSelfMessage ? source.linePart.left + 10 : Math.min(source.linePart.left, target.linePart.left) + 8;
  const labelView = edgeLabel(edge, message, label, left, y - 18, true, 10);
  const stereotype = edgeLabel(edge, message, '', left, y - 33, false, 25);
  const property = edgeLabel(edge, message, '', left, y + 5, false, 10);
  edge.subViews.push(labelView, stereotype, property);
  edge.nameLabel = ref(labelView); edge.stereotypeLabel = ref(stereotype); edge.propertyLabel = ref(property);
  addView(diagram, edge);
  return message;
}

function createSequence(model, name, participants, messages) {
  const collaboration = addOwned(model, element('UMLCollaboration', model, { name, ownedElements: [], attributes: [] }));
  const interaction = addOwned(collaboration, element('UMLInteraction', collaboration, { name, ownedElements: [], messages: [], participants: [], fragments: [] }));
  const diagram = addOwned(interaction, element('UMLSequenceDiagram', interaction, {
    name, ownedViews: [], showSequenceNumber: true, defaultDiagram: name.startsWith('SEQ-01'),
  }));
  const participantViews = {};
  const height = 140 + messages.length * 44;
  participants.forEach((participant, index) => {
    const classifier = addOwned(collaboration, element(participant.kind === 'actor' ? 'UMLActor' : 'UMLComponent', collaboration, {
      name: participant.name,
    }));
    participantViews[participant.key] = makeSequenceLifeline(diagram, interaction, collaboration, classifier, participant.name, 35 + index * 170, 35, height, participant.stereotype ?? '');
  });
  messages.forEach((message, index) => {
    makeSequenceMessage(diagram, interaction, participantViews[message.from], participantViews[message.to], message.label, 125 + index * 44, { reply: message.reply });
  });
  return { collaboration, interaction, diagram };
}

function createSequenceModels(project) {
  const model = addOwned(project, element('UMLModel', project, { name: '05 - Séquences', ownedElements: [] }));
  createSequence(model, 'SEQ-01 - Certification nominale', [
    { key: 'enterprise', name: 'Entreprise', kind: 'actor' }, { key: 'manager', name: 'Gestionnaire', kind: 'actor' },
    { key: 'evaluator', name: 'Évaluateur', kind: 'actor' }, { key: 'auditor', name: 'Auditeur', kind: 'actor' },
    { key: 'decision', name: 'Décideur', kind: 'actor' }, { key: 'ui', name: 'Angular', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'Django REST API', kind: 'component', stereotype: 'control' }, { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'enterprise', to: 'ui', label: 'déposer les justificatifs' }, { from: 'ui', to: 'api', label: 'POST /documents/{id}/upload' },
    { from: 'api', to: 'db', label: 'fichier + DOCUMENT_UPLOADED' }, { from: 'enterprise', to: 'ui', label: 'soumettre le dossier' },
    { from: 'ui', to: 'api', label: 'POST /applications/{id}/submit' }, { from: 'api', to: 'db', label: 'status = SUBMITTED' },
    { from: 'manager', to: 'ui', label: 'valider les justificatifs' }, { from: 'ui', to: 'api', label: 'POST /documents/{id}/review' },
    { from: 'manager', to: 'ui', label: 'démarrer l’évaluation' }, { from: 'ui', to: 'api', label: 'POST start-review → UNDER_REVIEW' },
    { from: 'manager', to: 'ui', label: 'affecter / planifier audit' }, { from: 'ui', to: 'api', label: 'POST assign + schedule-audit' },
    { from: 'evaluator', to: 'ui', label: 'démarrer / terminer évaluation' }, { from: 'auditor', to: 'ui', label: 'consigner l’audit' },
    { from: 'api', to: 'db', label: 'status = DECISION_PENDING' }, { from: 'decision', to: 'ui', label: 'décision favorable' },
    { from: 'ui', to: 'api', label: 'POST /applications/{id}/decide' }, { from: 'api', to: 'db', label: 'certificat + évènement' },
    { from: 'api', to: 'ui', label: 'numéro et validité (3 ans)', reply: true },
  ]);
  createSequence(model, 'SEQ-02 - Traitement d’une correction', [
    { key: 'enterprise', name: 'Entreprise', kind: 'actor' }, { key: 'reviewer', name: 'Évaluateur / Auditeur', kind: 'actor' },
    { key: 'ui', name: 'Angular', kind: 'component', stereotype: 'boundary' }, { key: 'api', name: 'Django REST API', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'reviewer', to: 'ui', label: 'décrire la non-conformité' }, { from: 'ui', to: 'api', label: 'POST request-correction' },
    { from: 'api', to: 'db', label: 'créer NC OPEN + statut CORRECTION_REQUIRED' }, { from: 'enterprise', to: 'ui', label: 'transmettre la réponse corrective' },
    { from: 'ui', to: 'api', label: 'POST respond-correction' }, { from: 'api', to: 'db', label: 'NC = CORRECTED' },
    { from: 'reviewer', to: 'ui', label: 'valider la correction' }, { from: 'ui', to: 'api', label: 'POST validate-correction' },
    { from: 'api', to: 'db', label: 'NC = VALIDATED' }, { from: 'api', to: 'db', label: 'si toutes validées : UNDER_REVIEW' },
    { from: 'api', to: 'ui', label: 'statut dossier mis à jour', reply: true },
  ]);
  createSequence(model, 'SEQ-03 - Authentification par session et CSRF', [
    { key: 'user', name: 'Utilisateur', kind: 'actor' }, { key: 'ui', name: 'Angular', kind: 'component', stereotype: 'boundary' },
    { key: 'auth', name: 'Django Auth', kind: 'component', stereotype: 'control' }, { key: 'session', name: 'Session / CSRF', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'ui', to: 'auth', label: 'GET /auth/csrf/' }, { from: 'auth', to: 'session', label: 'créer cookie CSRF' },
    { from: 'auth', to: 'ui', label: 'CSRF prêt', reply: true }, { from: 'user', to: 'ui', label: 'identifiant + mot de passe' },
    { from: 'ui', to: 'auth', label: 'POST /auth/login/ + X-CSRFToken' }, { from: 'auth', to: 'session', label: 'authenticate + login' },
    { from: 'auth', to: 'ui', label: 'rôle + capabilities + session HttpOnly', reply: true }, { from: 'ui', to: 'auth', label: 'GET /auth/me/' },
    { from: 'auth', to: 'ui', label: 'identité courante', reply: true }, { from: 'user', to: 'ui', label: 'se déconnecter' },
    { from: 'ui', to: 'auth', label: 'POST /auth/logout/' }, { from: 'auth', to: 'session', label: 'invalider la session' },
  ]);
  createSequence(model, 'SEQ-04 - Vérification publique d’un certificat', [
    { key: 'visitor', name: 'Visiteur', kind: 'actor' }, { key: 'ui', name: 'Portail Angular', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'Django REST API', kind: 'component', stereotype: 'control' }, { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'visitor', to: 'ui', label: 'saisir / scanner le numéro' }, { from: 'ui', to: 'api', label: 'GET /certificates/verify/?number=...' },
    { from: 'api', to: 'db', label: 'chercher certificat + organisation' }, { from: 'db', to: 'api', label: 'certificat trouvé / absent', reply: true },
    { from: 'api', to: 'api', label: 'calculer effective_status' }, { from: 'api', to: 'ui', label: 'statut, niveau, volets, validité', reply: true },
    { from: 'ui', to: 'visitor', label: 'afficher le résultat public', reply: true },
  ]);
  createSequence(model, 'SEQ-05 - Création d’un dossier et de sa checklist', [
    { key: 'enterprise', name: 'Entreprise', kind: 'actor' },
    { key: 'ui', name: 'Espace entreprise', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'ApplicationViewSet', kind: 'component', stereotype: 'control' },
    { key: 'serializer', name: 'ApplicationSerializer', kind: 'component', stereotype: 'control' },
    { key: 'catalog', name: 'Référentiel exigences', kind: 'component', stereotype: 'entity' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'enterprise', to: 'ui', label: 'saisir activité, niveau et volets' },
    { from: 'ui', to: 'api', label: 'POST /applications/' },
    { from: 'api', to: 'serializer', label: 'valider les données et le périmètre' },
    { from: 'serializer', to: 'api', label: 'données validées', reply: true },
    { from: 'api', to: 'catalog', label: 'synchronize_documents(application)' },
    { from: 'catalog', to: 'db', label: 'sélectionner les RequirementTemplate actives' },
    { from: 'api', to: 'db', label: 'créer Application + référence INPG-*' },
    { from: 'api', to: 'db', label: 'créer les RequiredDocument MISSING' },
    { from: 'api', to: 'db', label: 'créer WorkflowEvent DRAFT_CREATED' },
    { from: 'api', to: 'ui', label: '201 dossier + checklist', reply: true },
    { from: 'ui', to: 'enterprise', label: 'afficher le brouillon', reply: true },
  ]);
  createSequence(model, 'SEQ-06 - Contrôle documentaire et démarrage de revue', [
    { key: 'manager', name: 'Gestionnaire', kind: 'actor' },
    { key: 'ui', name: 'Back-office', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'Django REST API', kind: 'component', stereotype: 'control' },
    { key: 'permission', name: 'CapabilityPermission', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'manager', to: 'ui', label: 'ouvrir les justificatifs du dossier' },
    { from: 'ui', to: 'api', label: 'GET /applications/{id}/' },
    { from: 'api', to: 'permission', label: 'applications.read + périmètre' },
    { from: 'api', to: 'db', label: 'charger documents obligatoires' },
    { from: 'manager', to: 'ui', label: 'valider ou rejeter une pièce' },
    { from: 'ui', to: 'api', label: 'POST /documents/{id}/review' },
    { from: 'api', to: 'db', label: 'status + commentaire + reviewed_at' },
    { from: 'manager', to: 'ui', label: 'démarrer la revue' },
    { from: 'ui', to: 'api', label: 'POST /applications/{id}/start-review' },
    { from: 'api', to: 'db', label: 'vérifier toutes les pièces VALIDATED' },
    { from: 'api', to: 'db', label: 'status UNDER_REVIEW + évènement' },
    { from: 'api', to: 'ui', label: 'dossier en évaluation', reply: true },
  ]);
  createSequence(model, 'SEQ-07 - Affectation, planification et réalisation d’audit', [
    { key: 'manager', name: 'Gestionnaire', kind: 'actor' },
    { key: 'auditor', name: 'Auditeur', kind: 'actor' },
    { key: 'ui', name: 'Back-office', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'ApplicationViewSet', kind: 'component', stereotype: 'control' },
    { key: 'profiles', name: 'AccessProfile', kind: 'component', stereotype: 'entity' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'manager', to: 'ui', label: 'choisir évaluateur puis auditeur' },
    { from: 'ui', to: 'api', label: 'POST /applications/{id}/assign' },
    { from: 'api', to: 'profiles', label: 'vérifier EVALUATOR actif' },
    { from: 'api', to: 'db', label: 'get_or_create ApplicationAssignment' },
    { from: 'ui', to: 'api', label: 'POST /applications/{id}/schedule-audit' },
    { from: 'api', to: 'profiles', label: 'vérifier AUDITOR actif' },
    { from: 'api', to: 'api', label: 'valider une date future' },
    { from: 'api', to: 'db', label: 'créer Audit SCHEDULED + affectation' },
    { from: 'auditor', to: 'ui', label: 'saisir le compte rendu' },
    { from: 'ui', to: 'api', label: 'POST /applications/{id}/complete-audit' },
    { from: 'api', to: 'db', label: 'Audit COMPLETED + évènement' },
    { from: 'api', to: 'ui', label: 'audit réalisé', reply: true },
  ]);
  createSequence(model, 'SEQ-08 - Décision favorable et émission du certificat', [
    { key: 'evaluator', name: 'Évaluateur', kind: 'actor' },
    { key: 'decision', name: 'Décideur', kind: 'actor' },
    { key: 'ui', name: 'Back-office', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'Django REST API', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
    { key: 'pdf', name: 'Générateur PDF / QR', kind: 'component', stereotype: 'service' },
  ], [
    { from: 'evaluator', to: 'ui', label: 'terminer l’évaluation' },
    { from: 'ui', to: 'api', label: 'POST complete-evaluation' },
    { from: 'api', to: 'db', label: 'contrôler pièces et NC validées' },
    { from: 'api', to: 'db', label: 'status DECISION_PENDING' },
    { from: 'decision', to: 'ui', label: 'décision CERTIFIED + niveau' },
    { from: 'ui', to: 'api', label: 'POST /applications/{id}/decide' },
    { from: 'api', to: 'db', label: 'select_for_update du dossier' },
    { from: 'api', to: 'api', label: 'valider niveau et nombre de volets' },
    { from: 'api', to: 'db', label: 'créer Certificate, expiration +3 ans' },
    { from: 'api', to: 'db', label: 'WorkflowEvent DECISION_CERTIFIED' },
    { from: 'api', to: 'ui', label: 'numéro du certificat', reply: true },
    { from: 'decision', to: 'ui', label: 'télécharger le certificat' },
    { from: 'ui', to: 'api', label: 'GET /certificates/{id}/download' },
    { from: 'api', to: 'pdf', label: 'certificate_pdf(certificate)' },
    { from: 'pdf', to: 'ui', label: 'PDF avec QR code', reply: true },
  ]);
  createSequence(model, 'SEQ-09 - Décision de rejet', [
    { key: 'decision', name: 'Décideur', kind: 'actor' },
    { key: 'ui', name: 'Back-office', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'ApplicationViewSet', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'decision', to: 'ui', label: 'choisir REJECTED et saisir la note' },
    { from: 'ui', to: 'api', label: 'POST /applications/{id}/decide' },
    { from: 'api', to: 'db', label: 'verrouiller le dossier' },
    { from: 'api', to: 'api', label: 'exiger status DECISION_PENDING' },
    { from: 'api', to: 'db', label: 'status REJECTED' },
    { from: 'api', to: 'db', label: 'WorkflowEvent DECISION_REJECTED' },
    { from: 'api', to: 'ui', label: 'status REJECTED, aucun certificat', reply: true },
    { from: 'ui', to: 'decision', label: 'afficher la confirmation', reply: true },
  ]);
  createSequence(model, 'SEQ-10 - Suspension, réactivation ou révocation', [
    { key: 'admin', name: 'Décideur / Superutilisateur', kind: 'actor' },
    { key: 'ui', name: 'Back-office', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'CertificateViewSet', kind: 'component', stereotype: 'control' },
    { key: 'permission', name: 'CapabilityPermission', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'admin', to: 'ui', label: 'demander SUSPENDED, VALID ou REVOKED' },
    { from: 'ui', to: 'api', label: 'POST /certificates/{id}/update-status' },
    { from: 'api', to: 'permission', label: 'certificates.manage' },
    { from: 'api', to: 'db', label: 'select_for_update du certificat' },
    { from: 'api', to: 'api', label: 'calculer effective_status' },
    { from: 'api', to: 'api', label: 'contrôler la matrice de transitions' },
    { from: 'api', to: 'db', label: 'enregistrer le nouveau statut' },
    { from: 'api', to: 'db', label: 'WorkflowEvent CERTIFICATE_*' },
    { from: 'api', to: 'ui', label: 'certificat actualisé', reply: true },
  ]);
  createSequence(model, 'SEQ-11 - Inscription à une formation', [
    { key: 'user', name: 'Professionnel / Entreprise', kind: 'actor' },
    { key: 'ui', name: 'Catalogue Angular', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'TrainingViewSet', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'user', to: 'ui', label: 'consulter une formation active' },
    { from: 'ui', to: 'api', label: 'GET /trainings/{id}/' },
    { from: 'user', to: 'ui', label: 'demander l’inscription' },
    { from: 'ui', to: 'api', label: 'POST /trainings/{id}/enroll' },
    { from: 'api', to: 'db', label: 'verrouiller la formation' },
    { from: 'api', to: 'db', label: 'compter REQUESTED/CONFIRMED/COMPLETED' },
    { from: 'api', to: 'api', label: 'refuser si capacité atteinte' },
    { from: 'api', to: 'db', label: 'créer ou réactiver TrainingEnrollment' },
    { from: 'api', to: 'ui', label: 'inscription REQUESTED', reply: true },
  ]);
  createSequence(model, 'SEQ-12 - Création d’un compte interne', [
    { key: 'superuser', name: 'Superutilisateur', kind: 'actor' },
    { key: 'ui', name: 'Administration', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'admin_accounts', kind: 'component', stereotype: 'control' },
    { key: 'serializer', name: 'InternalAccountSerializer', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'User + AccessProfile', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'superuser', to: 'ui', label: 'saisir identité, rôle et mot de passe' },
    { from: 'ui', to: 'api', label: 'POST /admin/accounts/' },
    { from: 'api', to: 'api', label: 'exiger is_superuser' },
    { from: 'api', to: 'serializer', label: 'valider rôle interne et mot de passe' },
    { from: 'serializer', to: 'api', label: 'données validées', reply: true },
    { from: 'api', to: 'db', label: 'transaction : créer User' },
    { from: 'api', to: 'db', label: 'créer AccessProfile' },
    { from: 'api', to: 'ui', label: '201 compte interne', reply: true },
  ]);
  createSequence(model, 'SEQ-13 - Évènement métier et notifications', [
    { key: 'author', name: 'Utilisateur métier', kind: 'actor' },
    { key: 'recipient', name: 'Destinataire', kind: 'actor' },
    { key: 'ui', name: 'Angular', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'Django REST API', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'author', to: 'ui', label: 'déclencher une action métier notifiable' },
    { from: 'ui', to: 'api', label: 'POST action du workflow' },
    { from: 'api', to: 'db', label: 'créer WorkflowEvent' },
    { from: 'api', to: 'db', label: 'résoudre affectés, entreprise et superusers' },
    { from: 'api', to: 'db', label: 'bulk_create Notification, sauf auteur' },
    { from: 'api', to: 'ui', label: 'action confirmée', reply: true },
    { from: 'recipient', to: 'ui', label: 'ouvrir les notifications' },
    { from: 'ui', to: 'api', label: 'POST /notifications/{id}/mark-read' },
    { from: 'api', to: 'db', label: 'renseigner read_at' },
    { from: 'api', to: 'ui', label: 'notification lue', reply: true },
  ]);
  createSequence(model, 'SEQ-14 - Messagerie liée au dossier', [
    { key: 'author', name: 'Entreprise / Agent', kind: 'actor' },
    { key: 'ui', name: 'Angular', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'ApplicationMessageViewSet', kind: 'component', stereotype: 'control' },
    { key: 'access', name: 'can_access_application', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'author', to: 'ui', label: 'ouvrir la conversation du dossier' },
    { from: 'ui', to: 'api', label: 'GET /application-messages/?application={id}' },
    { from: 'api', to: 'access', label: 'vérifier rôle, organisation ou affectation' },
    { from: 'api', to: 'db', label: 'charger les messages par date' },
    { from: 'api', to: 'ui', label: 'historique autorisé', reply: true },
    { from: 'author', to: 'ui', label: 'rédiger le message' },
    { from: 'ui', to: 'api', label: 'POST /application-messages/' },
    { from: 'api', to: 'api', label: 'refuser un corps vide' },
    { from: 'api', to: 'db', label: 'créer message avec author courant' },
    { from: 'api', to: 'ui', label: '201 message enregistré', reply: true },
  ]);
  createSequence(model, 'SEQ-15 - Inscription publique d’un compte', [
    { key: 'visitor', name: 'Visiteur', kind: 'actor' },
    { key: 'ui', name: 'RegisterV2Component', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'registration.register', kind: 'component', stereotype: 'control' },
    { key: 'throttle', name: 'LoginThrottle', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'User / Organization / AccessProfile', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'visitor', to: 'ui', label: 'choisir le type de compte et saisir le formulaire' },
    { from: 'ui', to: 'api', label: 'GET /auth/csrf/ puis POST /auth/register/' },
    { from: 'api', to: 'throttle', label: 'allow_request(IP)' },
    { from: 'throttle', to: 'api', label: 'autorisé', reply: true },
    { from: 'api', to: 'api', label: 'valider longueurs, e-mail, identifiant' },
    { from: 'api', to: 'api', label: 'validate_password (10 car., non courant)' },
    { from: 'api', to: 'db', label: 'transaction.atomic : User.set_password + save' },
    { from: 'api', to: 'db', label: 'Organization (si ENTERPRISE)' },
    { from: 'api', to: 'db', label: 'AccessProfile(role = kind)' },
    { from: 'api', to: 'ui', label: '201 Compte créé / 400 / 429', reply: true },
    { from: 'ui', to: 'visitor', label: 'rediriger vers la connexion', reply: true },
  ]);
  createSequence(model, 'SEQ-16 - Dépôt sécurisé d’un justificatif', [
    { key: 'enterprise', name: 'Entreprise', kind: 'actor' },
    { key: 'ui', name: 'WorkflowDocumentsComponent', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'RequiredDocumentViewSet', kind: 'component', stereotype: 'control' },
    { key: 'storage', name: 'Stockage média privé', kind: 'component', stereotype: 'storage' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'enterprise', to: 'ui', label: 'choisir un fichier pour la pièce' },
    { from: 'ui', to: 'api', label: 'POST /documents/{id}/upload (multipart)' },
    { from: 'api', to: 'api', label: 'documents.upload + périmètre organisation' },
    { from: 'api', to: 'api', label: 'statut du dossier, taille, type, signature' },
    { from: 'api', to: 'db', label: 'somme des fichiers de l’organisation (quota)' },
    { from: 'api', to: 'storage', label: 'écrire documents/AAAA/MM/fichier' },
    { from: 'api', to: 'db', label: 'status SUBMITTED, submitted_at, commentaire vidé' },
    { from: 'api', to: 'storage', label: 'supprimer l’ancien fichier' },
    { from: 'api', to: 'db', label: 'WorkflowEvent DOCUMENT_UPLOADED' },
    { from: 'api', to: 'ui', label: 'pièce déposée', reply: true },
  ]);
  createSequence(model, 'SEQ-17 - Rejet d’une pièce et reprise du dossier', [
    { key: 'manager', name: 'Gestionnaire', kind: 'actor' },
    { key: 'enterprise', name: 'Entreprise', kind: 'actor' },
    { key: 'ui', name: 'Angular', kind: 'component', stereotype: 'boundary' },
    { key: 'api', name: 'Django REST API', kind: 'component', stereotype: 'control' },
    { key: 'db', name: 'Base relationnelle', kind: 'component', stereotype: 'database' },
  ], [
    { from: 'manager', to: 'ui', label: 'rejeter la pièce avec un commentaire' },
    { from: 'ui', to: 'api', label: 'POST /documents/{id}/review REJECTED' },
    { from: 'api', to: 'db', label: 'pièce REJECTED, reviewed_at' },
    { from: 'api', to: 'db', label: 'dossier SUBMITTED → CORRECTION_REQUIRED' },
    { from: 'api', to: 'db', label: 'DOCUMENT_REJECTED + notifications' },
    { from: 'enterprise', to: 'ui', label: 'redéposer la pièce' },
    { from: 'ui', to: 'api', label: 'POST /documents/{id}/upload' },
    { from: 'api', to: 'db', label: 'pièce SUBMITTED' },
    { from: 'enterprise', to: 'ui', label: 're-soumettre le dossier' },
    { from: 'ui', to: 'api', label: 'POST /applications/{id}/submit' },
    { from: 'api', to: 'api', label: 'NC toutes VALIDATED, pièces déposées' },
    { from: 'api', to: 'db', label: 'status SUBMITTED + évènement' },
    { from: 'api', to: 'ui', label: 'dossier de nouveau soumis', reply: true },
  ]);
  return model;
}

function makeSimpleDependency(model, source, target, name = '') {
  const dependency = addOwned(model, element('UMLDependency', model, { name, source: ref(source), target: ref(target) }));
  return dependency;
}

function createArchitectureModels(project) {
  const model = addOwned(project, element('UMLModel', project, { name: '06 - Architecture', ownedElements: [] }));
  function renderArchitectureDiagram(name, defs, dependencies, note, isDefault = false) {
    const diagram = addOwned(model, element('UMLComponentDiagram', model, { name, ownedViews: [], defaultDiagram: isDefault }));
    const components = {}, views = {};
    for (const [key, label, left, top, width, height, stereotype, kind = 'component'] of defs) {
      const type = kind === 'node' ? 'UMLNode' : 'UMLComponent';
      const item = addOwned(model, element(type, model, { name: label, stereotype, attributes: [] }));
      components[key] = item;
      views[key] = makeClassifierView(diagram, item, type === 'UMLNode' ? 'UMLNodeView' : 'UMLComponentView', left, top, width, height, {
        stereotype, showAttributes: false, fillColor: '#f5f9ff',
      });
    }
    for (const [source, target, label = ''] of dependencies) {
      const dependency = makeSimpleDependency(model, components[source], components[target], label);
      makeEdgeView(diagram, dependency, 'UMLDependencyView', views[source], views[target], boundaryPoints(views[source], views[target]), {
        label, stereotype: '', showVisibility: false,
      });
    }
    const bottom = Math.max(...defs.map(definition => definition[3] + definition[5]));
    makeTextView(diagram, note, 300, bottom + 55, 900, 40);
    return diagram;
  }

  renderArchitectureDiagram('ARC-01 - Vue d’ensemble technique', [
    ['browser', 'Navigateur utilisateur', 20, 245, 220, 85, 'device', 'node'],
    ['angular', 'SPA Angular 18', 300, 245, 220, 85, 'component'],
    ['api', 'Django REST Framework /api/v1', 590, 245, 270, 85, 'component'],
    ['orm', 'Django ORM', 920, 245, 200, 85, 'component'],
    ['db', 'Base relationnelle', 1170, 150, 200, 95, 'database', 'node'],
    ['media', 'Stockage média privé', 1170, 390, 200, 95, 'storage', 'node'],
  ], [
    ['browser', 'angular', 'HTTPS'], ['angular', 'api', 'HTTPS + JSON'],
    ['api', 'orm', 'transactions'], ['orm', 'db', 'SQL'], ['api', 'media', 'fichiers protégés'],
  ], 'Flux principal : navigateur → Angular → API Django → ORM → base ; les médias restent privés.', true);

  renderArchitectureDiagram('ARC-02 - Modules du frontend Angular', [
    ['angular', 'SPA Angular 18', 520, 270, 250, 85, 'component'],
    ['public', 'Portail public', 80, 70, 250, 75, 'component'],
    ['enterprise', 'Espace entreprise', 80, 260, 250, 75, 'component'],
    ['admin', 'Back-office', 80, 450, 250, 75, 'component'],
    ['core', 'Core : AuthService, guards, API', 950, 260, 300, 85, 'component'],
  ], [
    ['angular', 'public', 'routes'], ['angular', 'enterprise', 'routes'], ['angular', 'admin', 'routes'],
    ['public', 'core', 'utilise'], ['enterprise', 'core', 'utilise'], ['admin', 'core', 'utilise'],
  ], 'Les fonctionnalités restent séparées ; le module core centralise la session, les capacités et les appels HTTP.');

  renderArchitectureDiagram('ARC-03 - Services du backend Django', [
    ['api', 'Django REST API', 510, 260, 270, 85, 'component'],
    ['auth', 'SessionAuthentication + CSRF', 50, 70, 290, 75, 'component'],
    ['rbac', 'CapabilityPermission + périmètre', 50, 290, 290, 75, 'component'],
    ['workflow', 'Dossiers, audit et corrections', 960, 50, 290, 75, 'component'],
    ['documents', 'Documents, certificats PDF / QR', 960, 205, 290, 75, 'component'],
    ['training', 'Formations et inscriptions', 960, 360, 290, 75, 'component'],
    ['notifications', 'Messages et notifications', 960, 515, 290, 75, 'component'],
    ['orm', 'Django ORM', 525, 600, 240, 75, 'component'],
    ['media', 'Stockage média privé', 1360, 205, 250, 85, 'storage', 'node'],
  ], [
    ['api', 'auth', 'authentifie'], ['api', 'rbac', 'autorise'], ['api', 'workflow', 'orchestre'],
    ['api', 'documents', 'gère'], ['api', 'training', 'gère'], ['api', 'notifications', 'notifie'],
    ['api', 'orm', 'persiste'], ['documents', 'media', 'stocke'],
  ], 'L’API applique authentification et capacités avant les services métier ; l’ORM porte la persistance transactionnelle.');

  const deploymentDiagram = addOwned(model, element('UMLDeploymentDiagram', model, { name: 'ARC-04 - Déploiement logique', ownedViews: [] }));
  const nodeDefs = [
    ['client', 'Poste utilisateur\nNavigateur + SPA Angular', 45, 160, 270, 130, 'device'],
    ['web', 'Serveur web / reverse proxy\nTLS + fichiers Angular', 400, 160, 290, 130, 'device'],
    ['app', 'Serveur applicatif Python\nDjango + DRF + WSGI/ASGI', 790, 135, 330, 175, 'executionEnvironment'],
    ['database', 'SGBD relationnel administré', 1220, 60, 280, 120, 'database'],
    ['storage', 'Volume / stockage objet privé', 1220, 250, 280, 120, 'storage'],
  ];
  const nodes = {}, nodeViews = {};
  for (const [key, name, left, top, width, height, stereotype] of nodeDefs) {
    const item = addOwned(model, element('UMLNode', model, { name, stereotype, attributes: [] }));
    nodes[key] = item;
    nodeViews[key] = makeClassifierView(deploymentDiagram, item, 'UMLNodeView', left, top, width, height, { label: name, stereotype, showAttributes: false, fillColor: '#fffaf0' });
  }
  const paths = [
    ['client', 'web', 'HTTPS'], ['web', 'app', 'HTTPS /api'], ['app', 'database', 'ORM / SQL'], ['app', 'storage', 'fichiers déposés'],
  ];
  for (const [source, target, name] of paths) {
    const communication = addOwned(model, element('UMLCommunicationPath', model, { name, stereotype: 'protocol' }));
    communication.end1 = element('UMLAssociationEnd', communication, { reference: ref(nodes[source]) });
    communication.end2 = element('UMLAssociationEnd', communication, { reference: ref(nodes[target]) });
    makeEdgeView(deploymentDiagram, communication, 'UMLCommunicationPathView', nodeViews[source], nodeViews[target], orthogonalPoints(nodeViews[source], nodeViews[target]), { label: name, stereotype: 'protocol' });
  }
  makeTextView(deploymentDiagram, 'Production : SQLite est exclu ; TLS, sauvegardes, rétention, stockage privé et limites de requête doivent être configurés.', 380, 470, 800, 38);

  const securityDiagram = addOwned(model, element('UMLComponentDiagram', model, { name: 'ARC-05 - Chaîne de sécurité et RBAC', ownedViews: [] }));
  const securityDefs = [
    ['request', 'Requête HTTP', 40, 170, 190, 70], ['session', 'SessionAuthentication + CSRF', 290, 170, 260, 70],
    ['capability', 'CapabilityPermission', 610, 170, 230, 70], ['role', 'AccessProfile.role + superuser', 900, 170, 260, 70],
    ['scope', 'Filtrage du queryset / affectation', 1220, 170, 270, 70], ['transition', 'Contrôle de transition métier', 1550, 170, 270, 70],
  ];
  const security = {}, securityViews = {};
  for (const [key, name, left, top, width, height] of securityDefs) {
    const item = addOwned(model, element('UMLComponent', model, { name, stereotype: 'security', attributes: [] }));
    security[key] = item;
    securityViews[key] = makeClassifierView(securityDiagram, item, 'UMLComponentView', left, top, width, height, { stereotype: 'security', showAttributes: false, fillColor: '#f7f4ff' });
  }
  for (let index = 0; index < securityDefs.length - 1; index++) {
    const from = securityDefs[index][0], to = securityDefs[index + 1][0];
    const dependency = makeSimpleDependency(model, security[from], security[to], 'puis');
    makeEdgeView(securityDiagram, dependency, 'UMLDependencyView', securityViews[from], securityViews[to], orthogonalPoints(securityViews[from], securityViews[to]), { label: 'puis' });
  }
  makeTextView(securityDiagram, 'Défense en profondeur : authentification, capacité, périmètre objet et état source sont tous vérifiés.', 560, 310, 760, 32);
  return model;
}

function createPackageModel(project) {
  const model = addOwned(project, element('UMLModel', project, { name: '07 - Organisation du code', ownedElements: [] }));
  function renderPackageDiagram(name, defs, dependencies, note, isDefault = false) {
    const diagram = addOwned(model, element('UMLPackageDiagram', model, { name, ownedViews: [], defaultDiagram: isDefault }));
    const packages = {}, views = {};
    for (const [key, label, left, top, width, height] of defs) {
      const item = addOwned(model, element('UMLPackage', model, { name: label }));
      packages[key] = item;
      views[key] = makeNamedView(diagram, item, 'UMLPackageView', left, top, width, height, {
        label, nameHeight: height, fillColor: '#f8fbff',
      });
    }
    for (const [source, target] of dependencies) {
      const dependency = makeSimpleDependency(model, packages[source], packages[target], '');
      makeEdgeView(diagram, dependency, 'UMLDependencyView', views[source], views[target], boundaryPoints(views[source], views[target]), {
        label: '', stereotype: '', showVisibility: false,
      });
    }
    const bottom = Math.max(...defs.map(definition => definition[3] + definition[5]));
    makeTextView(diagram, note, 250, bottom + 55, 850, 38);
  }

  renderPackageDiagram('PKG-01 - Packages du frontend', [
    ['public', 'frontend.features.public', 60, 70, 280, 80],
    ['enterprise', 'frontend.features.enterprise', 60, 245, 280, 80],
    ['admin', 'frontend.features.admin', 60, 420, 280, 80],
    ['layouts', 'frontend.layouts', 470, 525, 280, 80],
    ['core', 'frontend.core\nauth, guards, services, models', 470, 235, 310, 110],
    ['api', 'backend REST /api/v1', 930, 250, 280, 80],
  ], [
    ['public', 'core'], ['enterprise', 'core'], ['admin', 'core'], ['layouts', 'core'], ['core', 'api'],
  ], 'Les features Angular dépendent du noyau transversal ; seul le noyau dialogue avec le contrat HTTP.', true);

  renderPackageDiagram('PKG-02 - Entrées du backend', [
    ['config', 'backend.config\nsettings, urls, WSGI / ASGI', 430, 45, 310, 110],
    ['views', 'platform_api.views\nViewSets et actions métier', 430, 280, 310, 100],
    ['auth', 'auth_views + registration', 60, 280, 280, 80],
    ['access', 'access + admin_accounts', 800, 280, 300, 80],
    ['workflow', 'workflow_views', 430, 500, 310, 80],
  ], [
    ['config', 'views'], ['config', 'auth'], ['views', 'access'], ['config', 'workflow'],
  ], 'Les URLs de configuration exposent les contrôleurs ; les contrôles d’accès restent un module séparé.');

  renderPackageDiagram('PKG-03 - Domaine et persistance backend', [
    ['views', 'platform_api.views', 55, 70, 260, 80],
    ['serializers', 'platform_api.serializers', 440, 70, 280, 80],
    ['catalog', 'platform_api.catalog', 850, 70, 260, 80],
    ['access', 'platform_api.access', 55, 345, 260, 80],
    ['models', 'platform_api.models', 440, 345, 280, 80],
    ['docs', 'docs\nRBAC, workflow, validation, UML', 850, 345, 290, 95],
  ], [
    ['views', 'serializers'], ['views', 'access'], ['views', 'catalog'],
    ['serializers', 'models'], ['serializers', 'catalog'], ['access', 'models'], ['docs', 'models'],
  ], 'Les modèles Django portent le domaine persistant ; serializers, accès et vues construisent l’API autour de lui.');
  return model;
}

const domainClasses = {};

function hiddenCompartment(view, model, type) {
  return element(type, view, { model: ref(model), visible: false, font: 'Arial;13;0', width: 10, height: 10 });
}

// StarUML recalcule les sous-vues des compartiments (attributs, opérations, littéraux, slots) au rendu.
function makeDetailedClassView(diagram, model, left, top, width, height, options = {}) {
  const type = options.type ?? 'UMLClassView';
  const view = makeNamedView(diagram, model, type, left, top, width, height, {
    stereotype: options.stereotype, nameHeight: options.stereotype ? 40 : 28, fillColor: options.fillColor ?? '#fffdf6',
  });
  const compartments = {
    attributeCompartment: element('UMLAttributeCompartmentView', view, { model: ref(model), subViews: [], font: 'Arial;12;0', visible: options.showAttributes !== false }),
    operationCompartment: element('UMLOperationCompartmentView', view, { model: ref(model), subViews: [], font: 'Arial;12;0', visible: options.showOperations !== false }),
    receptionCompartment: hiddenCompartment(view, model, 'UMLReceptionCompartmentView'),
    templateParameterCompartment: hiddenCompartment(view, model, 'UMLTemplateParameterCompartmentView'),
  };
  if (type === 'UMLEnumerationView') {
    compartments.enumerationLiteralCompartment = element('UMLEnumerationLiteralCompartmentView', view, { model: ref(model), subViews: [], font: 'Arial;12;0' });
  }
  for (const [property, compartment] of Object.entries(compartments)) {
    view.subViews.push(compartment);
    view[property] = ref(compartment);
  }
  view.suppressAttributes = options.showAttributes === false;
  view.suppressOperations = options.showOperations === false;
  if (type === 'UMLEnumerationView') view.suppressLiterals = false;
  return view;
}

function addOperation(owner, signature) {
  // signature : "nom(param: Type, ...): Retour"
  const match = /^([^(]+)\((.*)\)(?::\s*(.+))?$/.exec(signature);
  const [, name, rawParameters, returnType] = match;
  owner.operations ??= [];
  const operation = element('UMLOperation', owner, { name: name.trim(), parameters: [] });
  for (const rawParameter of rawParameters.split(',').map(value => value.trim()).filter(Boolean)) {
    const [parameterName, parameterType = ''] = rawParameter.split(':').map(value => value.trim());
    operation.parameters.push(element('UMLParameter', operation, { name: parameterName, type: parameterType, direction: 'in' }));
  }
  if (returnType) operation.parameters.push(element('UMLParameter', operation, { name: '', type: returnType.trim(), direction: 'return' }));
  owner.operations.push(operation);
  return operation;
}

function renderStructureDiagram(model, name, definitions, relations, note, options = {}) {
  const diagram = addOwned(model, element(options.diagramType ?? 'UMLClassDiagram', model, { name, ownedViews: [] }));
  const items = {};
  const views = {};
  for (const definition of definitions) {
    const { key, name: itemName, type = 'UMLClass', stereotype, attributes = [], operations = [], literals = [], position, existing, isAbstract } = definition;
    const item = existing ?? addOwned(model, element(type, model, {
      name: itemName, ...(stereotype ? { stereotype } : {}), ...(isAbstract ? { isAbstract: true } : {}), attributes: [],
    }));
    if (!existing) {
      for (const attribute of attributes) {
        const [attributeName, attributeType = '', isStatic] = attribute;
        addAttribute(item, attributeName, attributeType, isStatic ? { isStatic: true } : {});
      }
      for (const signature of operations) addOperation(item, signature);
      if (literals.length) item.literals = literals.map(literal => element('UMLEnumerationLiteral', item, { name: literal }));
    }
    const viewType = type === 'UMLEnumeration' ? 'UMLEnumerationView' : type === 'UMLInterface' ? 'UMLInterfaceView' : 'UMLClassView';
    items[key] = item;
    views[key] = makeDetailedClassView(diagram, item, ...position, {
      type: viewType, stereotype, showAttributes: definition.showAttributes, showOperations: definition.showOperations, fillColor: definition.fillColor,
    });
  }
  for (const [kind, source, target, label = ''] of relations) {
    const points = boundaryPoints(views[source], views[target]);
    if (kind === 'generalization') {
      const relation = addOwned(model, element('UMLGeneralization', model, { source: ref(items[source]), target: ref(items[target]) }));
      makeEdgeView(diagram, relation, 'UMLGeneralizationView', views[source], views[target], points, { label: '', lineStyle: 1, showVisibility: false });
    } else if (kind === 'realization') {
      const relation = addOwned(model, element('UMLInterfaceRealization', model, { source: ref(items[source]), target: ref(items[target]) }));
      makeEdgeView(diagram, relation, 'UMLInterfaceRealizationView', views[source], views[target], points, { label: '', lineStyle: 1, showVisibility: false });
    } else {
      const relation = addOwned(model, element('UMLDependency', model, { name: label, source: ref(items[source]), target: ref(items[target]) }));
      makeEdgeView(diagram, relation, 'UMLDependencyView', views[source], views[target], points, { label, lineStyle: 1, showVisibility: false });
    }
  }
  if (note) {
    const bottom = Math.max(...definitions.map(definition => definition.position[1] + definition.position[3]));
    makeTextView(diagram, note, options.noteLeft ?? 60, bottom + 70, options.noteWidth ?? 1000, 40);
  }
  return { diagram, items, views };
}

function createEnumerationDiagram(dataModel) {
  const enumerations = [
    ['Role', ['ENTERPRISE', 'PROFESSIONAL', 'MANAGER', 'EVALUATOR', 'AUDITOR', 'DECISION_MAKER', 'ADMIN'], [40, 50, 200, 180]],
    ['ApplicationStatus', ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'DECISION_PENDING', 'CERTIFIED', 'REJECTED'], [290, 50, 230, 180]],
    ['RequestType', ['INITIAL', 'RENEWAL'], [570, 50, 180, 90]],
    ['LabelLevel', ['Standard (1 volet)', 'Gold (2 volets)', 'Platinum (3 volets)'], [800, 50, 200, 110]],
    ['Domain', ['Sécurité', 'Qualité', 'Environnement'], [1050, 50, 190, 110]],
    ['Activity', ['Raffinage', 'Transport', 'Stockage', 'Distribution', 'Laboratoire', 'Prestataire technique'], [1050, 220, 210, 160]],
    ['DocumentStatus', ['MISSING', 'SUBMITTED', 'VALIDATED', 'REJECTED'], [40, 290, 200, 120]],
    ['AuditStatus', ['SCHEDULED', 'COMPLETED'], [290, 290, 200, 90]],
    ['NonConformityStatus', ['OPEN', 'CORRECTED', 'VALIDATED'], [570, 220, 210, 110]],
    ['Severity', ['MINEURE', 'MAJEURE', 'CRITIQUE'], [800, 220, 200, 110]],
    ['CertificateStatus', ['VALID', 'SUSPENDED', 'REVOKED', '«dérivé» EXPIRED'], [290, 440, 220, 120]],
    ['TrainingFormat', ['IN_PERSON', 'ONLINE', 'HYBRID'], [570, 400, 200, 110]],
    ['EnrollmentStatus', ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'], [800, 400, 210, 120]],
  ];
  renderStructureDiagram(dataModel, 'DM-07 - Énumérations et référentiels', enumerations.map(([name, literals, position]) => ({
    key: name, name, type: 'UMLEnumeration', stereotype: 'enumeration', literals, position, showAttributes: false, showOperations: false, fillColor: '#f4fbf4',
  })), [], 'Valeurs issues de models.py (TextChoices) et de catalog.py. EXPIRED n’est jamais stocké : Certificate.effective_status le calcule à partir de expires_at.');
}

function createObjectDiagram(dataModel) {
  const diagram = addOwned(dataModel, element('UMLObjectDiagram', dataModel, { name: 'OBJ-01 - Exemple de dossier certifié Gold', ownedViews: [] }));
  const objects = {};
  const views = {};
  const definitions = [
    ['organization', 'org', 'Organization', [['legal_name', '"Société Exemple SA"'], ['ninea', '"005432109"'], ['activity', '"Distribution"']], [40, 230, 250, 110]],
    ['enterpriseUser', 'responsable', 'User', [['username', '"exemple.qse"'], ['is_active', 'true']], [420, 40, 230, 90]],
    ['profile', 'profil', 'AccessProfile', [['role', 'ENTERPRISE']], [40, 50, 230, 70]],
    ['application', 'dossier', 'Application', [['reference', '"INPG-3F9A…"'], ['level', 'Gold'], ['domains', '[Sécurité, Qualité]'], ['status', 'CERTIFIED']], [420, 220, 270, 130]],
    ['document', 'pièceQualité', 'RequiredDocument', [['domain', 'Qualité'], ['name', '"Politique qualité"'], ['status', 'VALIDATED']], [820, 40, 270, 110]],
    ['evaluator', 'évaluateur', 'User', [['username', '"eval.inpg"']], [1150, 245, 230, 70]],
    ['assignment', 'affectation', 'ApplicationAssignment', [], [820, 250, 250, 60]],
    ['audit', 'auditSurSite', 'Audit', [['status', 'COMPLETED'], ['summary', '"Visite conforme"']], [820, 420, 250, 90]],
    ['nc', 'nc1', 'NonConformity', [['reference', '"NC-12-001"'], ['severity', 'MINEURE'], ['status', 'VALIDATED']], [420, 450, 270, 110]],
    ['certificate', 'certificat', 'Certificate', [['number', '"CERT-INPG-8C21…"'], ['status', 'VALID'], ['expires_at', 'issued_at + 3 ans']], [40, 450, 280, 110]],
  ];
  for (const [key, name, className, slots, position] of definitions) {
    const object = addOwned(dataModel, element('UMLObject', dataModel, { name, classifier: ref(domainClasses[className]), slots: [] }));
    for (const [slotName, value] of slots) object.slots.push(element('UMLSlot', object, { name: slotName, value }));
    objects[key] = object;
    const view = makeNamedView(diagram, object, 'UMLObjectView', ...position, { fillColor: '#fff8f0' });
    const slotCompartment = element('UMLSlotCompartmentView', view, { model: ref(object), subViews: [], font: 'Arial;12;0' });
    view.subViews.push(slotCompartment);
    view.slotCompartment = ref(slotCompartment);
    views[key] = view;
  }
  const links = [
    ['organization', 'application'], ['organization', 'profile'], ['enterpriseUser', 'profile'], ['application', 'document'],
    ['application', 'assignment'], ['evaluator', 'assignment'], ['application', 'audit'], ['application', 'nc'], ['application', 'certificate'],
  ];
  for (const [source, target] of links) {
    const link = addOwned(dataModel, element('UMLLink', dataModel, { name: '' }));
    link.end1 = element('UMLLinkEnd', link, { reference: ref(objects[source]) });
    link.end2 = element('UMLLinkEnd', link, { reference: ref(objects[target]) });
    makeEdgeView(diagram, link, 'UMLLinkView', views[source], views[target], boundaryPoints(views[source], views[target]), { label: '', lineStyle: 1, showVisibility: false });
  }
  makeTextView(diagram, 'Instantané après décision favorable : Gold impose exactement deux volets ; toutes les pièces obligatoires et toutes les NC sont VALIDATED ; le certificat expire trois ans après son émission.', 40, 640, 1100, 40);
}

function createDesignModels(project) {
  const model = addOwned(project, element('UMLModel', project, { name: '08 - Conception détaillée', ownedElements: [] }));
  const drf = { fillColor: '#f2f2f2' };
  const modelViewSet = addOwned(model, element('UMLClass', model, { name: 'ModelViewSet', stereotype: 'DRF', attributes: [] }));
  for (const signature of ['list()', 'retrieve()', 'create()', 'update()', 'destroy()', 'get_queryset(): QuerySet']) addOperation(modelViewSet, signature);

  renderStructureDiagram(model, 'CLS-01 - Contrôleurs du workflow de certification', [
    { key: 'base', existing: modelViewSet, stereotype: 'DRF', position: [560, 30, 230, 150], showAttributes: false, ...drf },
    { key: 'application', name: 'ApplicationViewSet', stereotype: 'ViewSet', attributes: [['action_capabilities', 'dict', true]], operations: [
      'get_queryset(): QuerySet', 'perform_create(serializer)', 'perform_update(serializer)', 'submit(request, pk)', 'assign(request, pk)',
      'start_review(request, pk)', 'schedule_audit(request, pk)', 'complete_audit(request, pk)', 'request_correction(request, pk)',
      'respond_correction(request, pk)', 'validate_correction(request, pk)', 'complete_evaluation(request, pk)', 'decide(request, pk)',
    ], position: [40, 290, 330, 330] },
    { key: 'document', name: 'RequiredDocumentViewSet', stereotype: 'ViewSet', attributes: [['parser_classes', 'list', true], ['action_capabilities', 'dict', true]], operations: [
      'get_queryset(): QuerySet', 'upload(request, pk)', 'download(request, pk): FileResponse', 'review(request, pk)',
    ], position: [470, 290, 330, 180] },
    { key: 'certificate', name: 'CertificateViewSet', stereotype: 'ViewSet', attributes: [['action_capabilities', 'dict', true]], operations: [
      'get_queryset(): QuerySet', 'update_status(request, pk)', 'download(request, pk): FileResponse',
    ], position: [900, 290, 320, 150] },
    { key: 'permission', name: 'CapabilityPermission', stereotype: 'permission', operations: ['has_permission(request, view): bool'], showAttributes: false, position: [470, 590, 300, 80] },
    { key: 'services', name: 'workflow services', stereotype: 'module', operations: [
      'synchronize_documents(application)', 'requirement_rows(application): list', 'event(application, user, type, note): WorkflowEvent',
      'can_access_application(user, application): bool', 'certificate_pdf(certificate): BytesIO', 'add_years(value, years): datetime',
    ], showAttributes: false, position: [900, 560, 380, 160] },
  ], [
    ['generalization', 'application', 'base'], ['generalization', 'document', 'base'], ['generalization', 'certificate', 'base'],
    ['dependency', 'application', 'permission', 'permission_classes'], ['dependency', 'document', 'permission'], ['dependency', 'certificate', 'permission'],
    ['dependency', 'application', 'services', 'utilise'], ['dependency', 'document', 'services'], ['dependency', 'certificate', 'services'],
  ], 'Chaque action exposée est associée à une capacité dans action_capabilities ; les transitions sont exécutées dans une transaction avec select_for_update pour submit, decide et update_status.');

  renderStructureDiagram(model, 'CLS-02 - Contrôleurs de référentiel, formation et communication', [
    { key: 'base', existing: modelViewSet, stereotype: 'DRF', position: [960, 30, 240, 150], showAttributes: false, ...drf },
    { key: 'organization', name: 'OrganizationViewSet', stereotype: 'ViewSet', operations: ['get_queryset(): QuerySet'], showAttributes: false, position: [30, 300, 230, 80] },
    { key: 'training', name: 'TrainingViewSet', stereotype: 'ViewSet', operations: ['get_queryset(): QuerySet', 'enroll(request, pk)'], showAttributes: false, position: [280, 300, 230, 90] },
    { key: 'enrollment', name: 'TrainingEnrollmentViewSet', stereotype: 'ViewSet', operations: ['get_queryset(): QuerySet', 'update_status(request, pk)'], showAttributes: false, position: [530, 300, 260, 90] },
    { key: 'audit', name: 'AuditViewSet', stereotype: 'ViewSet, lecture seule', operations: ['get_queryset(): QuerySet'], showAttributes: false, position: [810, 300, 230, 80] },
    { key: 'nc', name: 'NonConformityViewSet', stereotype: 'ViewSet, lecture seule', operations: ['get_queryset(): QuerySet'], showAttributes: false, position: [1060, 300, 250, 80] },
    { key: 'template', name: 'RequirementTemplateViewSet', stereotype: 'ViewSet', operations: [], showAttributes: false, position: [1330, 300, 260, 60] },
    { key: 'message', name: 'ApplicationMessageViewSet', stereotype: 'ViewSet', operations: ['get_queryset(): QuerySet', 'perform_create(serializer)'], showAttributes: false, position: [1610, 300, 270, 90] },
    { key: 'notification', name: 'NotificationViewSet', stereotype: 'ViewSet', operations: ['get_queryset(): QuerySet', 'mark_read(request, pk)'], showAttributes: false, position: [1900, 300, 260, 90] },
  ], [
    ...['organization', 'training', 'enrollment', 'audit', 'nc', 'template', 'message', 'notification'].map(key => ['generalization', key, 'base']),
  ], 'Audits et non-conformités sont en lecture seule (GET) : leur écriture passe par les actions de ApplicationViewSet. Les notifications sont toujours filtrées sur l’utilisateur courant.');

  renderStructureDiagram(model, 'CLS-03 - Sécurité, authentification et comptes', [
    { key: 'basePermission', name: 'BasePermission', stereotype: 'DRF', operations: ['has_permission(request, view): bool'], showAttributes: false, position: [420, 30, 260, 80], ...drf },
    { key: 'capability', name: 'CapabilityPermission', operations: ['has_permission(request, view): bool'], attributes: [['message', 'str']], position: [180, 220, 280, 100] },
    { key: 'superuser', name: 'IsSuperuser', operations: ['has_permission(request, view): bool'], showAttributes: false, position: [640, 220, 260, 80] },
    { key: 'access', name: 'access', stereotype: 'module', attributes: [['CAPABILITIES', 'dict[Role, list[str]]', true]], operations: [
      'profile(user): AccessProfile', 'role(user): str', 'capabilities(user): list[str]',
    ], position: [120, 420, 320, 140] },
    { key: 'auth', name: 'auth_views', stereotype: 'module', operations: ['csrf(request)', 'me(request)', 'sign_in(request)', 'sign_out(request)', 'identity(user): dict'], showAttributes: false, position: [450, 640, 260, 140] },
    { key: 'throttle', name: 'LoginThrottle', stereotype: 'AnonRateThrottle', operations: [], attributes: [['scope', 'str']], position: [780, 660, 240, 80] },
    { key: 'registration', name: 'registration', stereotype: 'module', operations: ['register(request): JsonResponse'], showAttributes: false, position: [1080, 660, 260, 80] },
    { key: 'admin', name: 'admin_accounts', stereotype: 'module', operations: ['create_internal_account(request): Response'], showAttributes: false, position: [560, 420, 300, 80] },
    { key: 'internalSerializer', name: 'InternalAccountSerializer', stereotype: 'Serializer', operations: ['validate_username(value)', 'validate_password(value)'], showAttributes: false, position: [950, 420, 280, 90] },
    { key: 'profile', existing: domainClasses.AccessProfile, position: [120, 650, 260, 80], showOperations: false },
  ], [
    ['generalization', 'capability', 'basePermission'], ['generalization', 'superuser', 'basePermission'],
    ['dependency', 'capability', 'access', 'capabilities()'], ['dependency', 'access', 'profile', 'lit'], ['dependency', 'auth', 'access', 'identity'],
    ['dependency', 'auth', 'throttle'], ['dependency', 'registration', 'throttle'], ['dependency', 'admin', 'superuser'], ['dependency', 'admin', 'internalSerializer'],
  ], 'Authentification par session Django et CSRF. Les connexions et inscriptions sont limitées par LoginThrottle ; la création de comptes internes exige is_superuser.');

  const modelSerializer = { name: 'ModelSerializer', stereotype: 'DRF', operations: ['validate(attrs)', 'to_representation(instance)'], showAttributes: false, ...drf };
  renderStructureDiagram(model, 'CLS-04 - Sérialiseurs de l’API', [
    { key: 'base', ...modelSerializer, position: [560, 330, 250, 90] },
    { key: 'application', name: 'ApplicationSerializer', operations: ['get_certification_status(obj)', 'get_has_active_certificate(obj)', 'validate_level(value)', 'validate_activity(value)', 'validate_domains(value)', 'validate(attrs)'], showAttributes: false, position: [30, 30, 300, 170] },
    { key: 'certificate', name: 'CertificateSerializer', operations: ['get_status(obj): effective_status', 'get_verification_url(obj)'], showAttributes: false, position: [360, 30, 290, 100] },
    { key: 'document', name: 'RequiredDocumentSerializer', operations: ['get_file(obj)'], showAttributes: false, position: [680, 30, 270, 80] },
    { key: 'training', name: 'TrainingSerializer', operations: ['get_enrollment_status(obj)'], showAttributes: false, position: [980, 30, 270, 80] },
    { key: 'organization', name: 'OrganizationSerializer', operations: ['validate_activity(value)'], showAttributes: false, position: [200, 600, 270, 80] },
    { key: 'template', name: 'RequirementTemplateSerializer', operations: ['validate_domain(value)', 'validate_activity(value)'], showAttributes: false, position: [560, 600, 290, 90] },
    { key: 'others', name: 'Sérialiseurs simples', stereotype: 'groupe', operations: [], attributes: [
      ['WorkflowEventSerializer', ''], ['AuditSerializer', ''], ['NonConformitySerializer', ''], ['TrainingEnrollmentSerializer', ''], ['ApplicationMessageSerializer', ''], ['NotificationSerializer', ''],
    ], position: [900, 600, 280, 150] },
    { key: 'catalog', name: 'catalog', stereotype: 'module', attributes: [['LABEL_LEVELS', 'tuple', true], ['DOMAINS', 'tuple', true], ['ACTIVITIES', 'tuple', true], ['NON_CONFORMITY_SEVERITIES', 'tuple', true], ['REQUIRED_DOCUMENTS', 'dict', true], ['ACTIVITY_DOCUMENTS', 'dict', true]], showOperations: false, position: [30, 300, 320, 150] },
  ], [
    ...['application', 'certificate', 'document', 'training', 'organization', 'template', 'others'].map(key => ['generalization', key, 'base']),
    ['dependency', 'application', 'catalog', 'valide'], ['dependency', 'organization', 'catalog'], ['dependency', 'template', 'catalog'],
  ], 'Les champs sensibles (status, reference, file, organization des inscriptions…) sont en lecture seule : seuls les endpoints d’action peuvent les modifier.');

  renderStructureDiagram(model, 'CLS-05 - Noyau du frontend Angular', [
    { key: 'identity', name: 'Identity', type: 'UMLInterface', stereotype: 'interface', attributes: [['id', 'number'], ['username', 'string'], ['role', 'string | null'], ['capabilities', 'string[]'], ['is_superuser', 'boolean'], ['organization_id', 'number | null']], showOperations: false, position: [40, 40, 250, 150] },
    { key: 'authService', name: 'AuthService', stereotype: 'Injectable', attributes: [['user', 'Signal<Identity | null>']], operations: ['refresh(): Promise<Identity | null>', 'has(capability: string): boolean', 'login(username, password): Promise<void>', 'logout(): Promise<void>'], position: [400, 40, 320, 150] },
    { key: 'guards', name: 'auth.guard', stereotype: 'module', attributes: [['enterpriseAccess', 'Record<string, string>', true], ['adminAccess', 'Record<string, string>', true]], operations: ['sessionGuard(route, state): CanActivateFn', 'childAccessGuard(route, state): CanActivateChildFn'], position: [820, 40, 360, 140] },
    { key: 'referential', name: 'ReferentialService', stereotype: 'Injectable', operations: ['checklist(actor: ActorType, domains: Domain[]): RequiredDocument[]'], showAttributes: false, position: [40, 600, 380, 80] },
    { key: 'routes', name: 'app.routes', stereotype: 'Routes', attributes: [['/ (PublicShell)', 'public'], ['/espace (EnterpriseShell)', 'portal.enterprise'], ['/admin (AdminShell)', 'portal.admin'], ['/professionnel', 'portal.professional'], ['/inscription, /connexion', 'public']], showOperations: false, position: [1260, 40, 300, 150] },
    { key: 'enterprise', name: 'Composants entreprise', stereotype: 'feature', attributes: [['EnterpriseDashboardComponent', ''], ['CertificationFormComponent', ''], ['CertificationTrackingComponent', ''], ['WorkflowDocumentsComponent', ''], ['WorkflowCorrectionsComponent', ''], ['EnterpriseCertificatesComponent', '']], showOperations: false, position: [40, 320, 310, 150] },
    { key: 'admin', name: 'Composants back-office', stereotype: 'feature', attributes: [['AdminConsoleComponent', ''], ['AdminWorkflowComponent', ''], ['EvaluationsComponent', ''], ['ReferentialsComponent', ''], ['TrainingCreateComponent', '']], showOperations: false, position: [420, 320, 300, 140] },
    { key: 'public', name: 'Composants publics', stereotype: 'feature', attributes: [['HomeComponent', ''], ['ExploreComponent', ''], ['PublicDetailComponent', ''], ['LoginComponent', ''], ['RegisterV2Component', ''], ['ProfessionalComponent', '']], showOperations: false, position: [800, 320, 280, 150] },
  ], [
    ['dependency', 'authService', 'identity', 'expose'], ['dependency', 'guards', 'authService', 'inject'], ['dependency', 'routes', 'guards', 'canActivate'],
    ['dependency', 'enterprise', 'authService'], ['dependency', 'admin', 'authService'], ['dependency', 'public', 'authService'], ['dependency', 'enterprise', 'referential'],
  ], 'Les gardes ne font que masquer la navigation : le serveur reste l’autorité (CapabilityPermission et périmètre des objets).');
  return model;
}

const ERD_COLUMNS = {
  auth_user: [['id', 'INTEGER', { primaryKey: true }], ['username', 'VARCHAR', { length: '150', unique: true }], ['email', 'VARCHAR', { length: '254' }], ['password', 'VARCHAR', { length: '128' }], ['is_active', 'BOOLEAN'], ['is_superuser', 'BOOLEAN']],
  platform_api_organization: [['id', 'BIGINT', { primaryKey: true }], ['legal_name', 'VARCHAR', { length: '255' }], ['ninea', 'VARCHAR', { length: '64', unique: true }], ['activity', 'VARCHAR', { length: '32' }], ['address', 'VARCHAR', { length: '255' }]],
  platform_api_accessprofile: [['id', 'BIGINT', { primaryKey: true }], ['user_id', 'INTEGER', { foreignKey: true, unique: true, ref: 'auth_user' }], ['role', 'VARCHAR', { length: '24' }], ['organization_id', 'BIGINT', { foreignKey: true, nullable: true, ref: 'platform_api_organization' }]],
  platform_api_application: [['id', 'BIGINT', { primaryKey: true }], ['organization_id', 'BIGINT', { foreignKey: true, ref: 'platform_api_organization' }], ['reference', 'VARCHAR', { length: '32', unique: true }], ['request_type', 'VARCHAR', { length: '16' }], ['level', 'VARCHAR', { length: '16' }], ['activity', 'VARCHAR', { length: '32' }], ['status', 'VARCHAR', { length: '24' }], ['domains', 'TEXT'], ['scope', 'VARCHAR', { length: '500' }], ['description', 'TEXT'], ['created_at', 'DATETIME']],
  platform_api_applicationassignment: [['id', 'BIGINT', { primaryKey: true }], ['application_id', 'BIGINT', { foreignKey: true, ref: 'platform_api_application' }], ['user_id', 'INTEGER', { foreignKey: true, ref: 'auth_user' }]],
  platform_api_requireddocument: [['id', 'BIGINT', { primaryKey: true }], ['application_id', 'BIGINT', { foreignKey: true, ref: 'platform_api_application' }], ['domain', 'VARCHAR', { length: '32' }], ['name', 'VARCHAR', { length: '255' }], ['mandatory', 'BOOLEAN'], ['status', 'VARCHAR', { length: '24' }], ['file', 'VARCHAR', { length: '100', nullable: true }], ['review_comment', 'TEXT'], ['submitted_at', 'DATETIME', { nullable: true }], ['reviewed_at', 'DATETIME', { nullable: true }]],
  platform_api_workflowevent: [['id', 'BIGINT', { primaryKey: true }], ['application_id', 'BIGINT', { foreignKey: true, ref: 'platform_api_application' }], ['actor_id', 'INTEGER', { foreignKey: true, nullable: true, ref: 'auth_user' }], ['event_type', 'VARCHAR', { length: '48' }], ['note', 'TEXT'], ['created_at', 'DATETIME']],
  platform_api_audit: [['id', 'BIGINT', { primaryKey: true }], ['application_id', 'BIGINT', { foreignKey: true, ref: 'platform_api_application' }], ['auditor_id', 'INTEGER', { foreignKey: true, ref: 'auth_user' }], ['scheduled_for', 'DATETIME', { nullable: true }], ['performed_at', 'DATETIME', { nullable: true }], ['status', 'VARCHAR', { length: '16' }], ['summary', 'TEXT']],
  platform_api_nonconformity: [['id', 'BIGINT', { primaryKey: true }], ['application_id', 'BIGINT', { foreignKey: true, ref: 'platform_api_application' }], ['reference', 'VARCHAR', { length: '32' }], ['domain', 'VARCHAR', { length: '32' }], ['description', 'TEXT'], ['severity', 'VARCHAR', { length: '16' }], ['status', 'VARCHAR', { length: '16' }], ['response', 'TEXT'], ['created_at', 'DATETIME']],
  platform_api_certificate: [['id', 'BIGINT', { primaryKey: true }], ['application_id', 'BIGINT', { foreignKey: true, unique: true, ref: 'platform_api_application' }], ['number', 'VARCHAR', { length: '48', unique: true }], ['issued_at', 'DATETIME'], ['status', 'VARCHAR', { length: '16' }], ['expires_at', 'DATETIME', { nullable: true }]],
  platform_api_applicationmessage: [['id', 'BIGINT', { primaryKey: true }], ['application_id', 'BIGINT', { foreignKey: true, ref: 'platform_api_application' }], ['author_id', 'INTEGER', { foreignKey: true, nullable: true, ref: 'auth_user' }], ['body', 'TEXT'], ['created_at', 'DATETIME']],
  platform_api_notification: [['id', 'BIGINT', { primaryKey: true }], ['user_id', 'INTEGER', { foreignKey: true, ref: 'auth_user' }], ['title', 'VARCHAR', { length: '160' }], ['body', 'TEXT'], ['url', 'VARCHAR', { length: '255' }], ['read_at', 'DATETIME', { nullable: true }], ['created_at', 'DATETIME']],
  platform_api_training: [['id', 'BIGINT', { primaryKey: true }], ['title', 'VARCHAR', { length: '255' }], ['description', 'TEXT'], ['duration_days', 'SMALLINT'], ['format', 'VARCHAR', { length: '16' }], ['starts_at', 'DATETIME', { nullable: true }], ['capacity', 'INTEGER'], ['active', 'BOOLEAN'], ['created_at', 'DATETIME']],
  platform_api_trainingenrollment: [['id', 'BIGINT', { primaryKey: true }], ['training_id', 'BIGINT', { foreignKey: true, ref: 'platform_api_training' }], ['user_id', 'INTEGER', { foreignKey: true, ref: 'auth_user' }], ['organization_id', 'BIGINT', { foreignKey: true, nullable: true, ref: 'platform_api_organization' }], ['status', 'VARCHAR', { length: '16' }], ['enrolled_at', 'DATETIME']],
  platform_api_requirementtemplate: [['id', 'BIGINT', { primaryKey: true }], ['domain', 'VARCHAR', { length: '32' }], ['activity', 'VARCHAR', { length: '32' }], ['name', 'VARCHAR', { length: '255' }], ['mandatory', 'BOOLEAN'], ['active', 'BOOLEAN'], ['version', 'VARCHAR', { length: '16' }], ['created_at', 'DATETIME']],
};

function createErdModel(project) {
  const dataModel = addOwned(project, element('ERDDataModel', project, { name: '09 - Schéma relationnel', ownedElements: [] }));
  const entities = {};
  const columns = {};
  for (const [table, definitions] of Object.entries(ERD_COLUMNS)) {
    const entity = addOwned(dataModel, element('ERDEntity', dataModel, { name: table, columns: [] }));
    for (const [name, type, options = {}] of definitions) {
      const { ref: target, ...flags } = options;
      const column = element('ERDColumn', entity, { name, type, ...flags });
      entity.columns.push(column);
      columns[`${table}.${name}`] = { column, target };
    }
    entities[table] = entity;
  }
  for (const { column, target } of Object.values(columns)) {
    if (target) column.referenceTo = ref(columns[`${target}.id`].column);
  }
  const relationships = {};
  for (const [key, { column, target }] of Object.entries(columns)) {
    if (!target) continue;
    const table = key.split('.')[0];
    const relationship = addOwned(dataModel, element('ERDRelationship', dataModel, { name: '', identifying: false }));
    relationship.end1 = element('ERDRelationshipEnd', relationship, { reference: ref(entities[target]), cardinality: column.nullable ? '0..1' : '1' });
    relationship.end2 = element('ERDRelationshipEnd', relationship, { reference: ref(entities[table]), cardinality: column.unique ? '0..1' : '0..*' });
    relationships[key] = relationship;
  }

  function erdDiagram(name, positions, note, hiddenRelations = []) {
    const diagram = addOwned(dataModel, element('ERDDiagram', dataModel, { name, ownedViews: [] }));
    const views = {};
    for (const [table, [left, top, width]] of Object.entries(positions)) {
      const entity = entities[table];
      const view = element('ERDEntityView', diagram, { model: ref(entity), subViews: [], font: 'Arial;13;0', left, top, width, height: 40 + entity.columns.length * 18 });
      const nameLabel = element('LabelView', view, { font: 'Arial;13;1', horizontalAlignment: 2, text: table, parentStyle: true });
      const compartment = element('ERDColumnCompartmentView', view, { model: ref(entity), subViews: [], font: 'Arial;13;0', parentStyle: true });
      view.subViews.push(nameLabel, compartment);
      view.nameLabel = ref(nameLabel);
      view.columnCompartment = ref(compartment);
      addView(diagram, view);
      views[table] = view;
    }
    for (const [key, relationship] of Object.entries(relationships)) {
      const table = key.split('.')[0];
      const target = columns[key].target;
      if (!views[table] || !views[target] || hiddenRelations.includes(key)) continue;
      const edge = element('ERDRelationshipView', diagram, {
        model: ref(relationship), subViews: [], font: 'Arial;13;0', lineStyle: 1,
        tail: ref(views[target]), head: ref(views[table]), points: boundaryPoints(views[target], views[table]),
      });
      for (const property of ['nameLabel', 'tailNameLabel', 'headNameLabel']) {
        const label = element('EdgeLabelView', edge, { font: 'Arial;13;0', hostEdge: ref(edge), visible: false, edgePosition: property === 'tailNameLabel' ? 0 : property === 'headNameLabel' ? 2 : 1 });
        edge.subViews.push(label);
        edge[property] = ref(label);
      }
      addView(diagram, edge);
    }
    const bottom = Math.max(...Object.entries(positions).map(([table, [, top]]) => top + 40 + entities[table].columns.length * 18));
    makeTextView(diagram, note, 40, bottom + 60, 1100, 40);
  }

  erdDiagram('ERD-01 - Identités, organisations et dossiers', {
    platform_api_accessprofile: [40, 40, 330], platform_api_organization: [470, 40, 320], platform_api_requirementtemplate: [900, 40, 330],
    auth_user: [40, 300, 300], platform_api_application: [470, 290, 330], platform_api_requireddocument: [900, 290, 340],
    platform_api_applicationassignment: [40, 600, 340], platform_api_workflowevent: [470, 620, 330],
  },'Contraintes : accessprofile.user_id unique (1–1) ; applicationassignment unique (application_id, user_id) ; requirement_template sans clé étrangère, copié dans la checklist à la création du dossier.');

  erdDiagram('ERD-02 - Instruction, certificat, communication et formations', {
    platform_api_certificate: [40, 40, 330], platform_api_application: [470, 40, 330], platform_api_nonconformity: [900, 40, 330],
    platform_api_audit: [40, 350, 330], auth_user: [470, 400, 300], platform_api_applicationmessage: [900, 350, 330],
    platform_api_notification: [40, 660, 330], platform_api_trainingenrollment: [470, 680, 340], platform_api_training: [900, 640, 330],
    platform_api_organization: [470, 920, 320],
  },'Contraintes : certificate.application_id unique (0..1 par dossier) ; nonconformity unique (application_id, reference) ; trainingenrollment unique (training_id, user_id). on_delete PROTECT pour organisation, auditeur et certificat. Le lien dossier → organisation figure dans ERD-01.', ['platform_api_application.organization_id']);
  return dataModel;
}

function validateProject(project) {
  const ids = new Set();
  const references = [];
  const diagrams = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value._id) {
      if (ids.has(value._id)) throw new Error(`Identifiant StarUML dupliqué : ${value._id}`);
      ids.add(value._id);
    }
    if (value._type?.endsWith('Diagram')) diagrams.push(value);
    if (Object.keys(value).length === 1 && value.$ref) references.push(value.$ref);
    for (const item of Object.values(value)) {
      if (Array.isArray(item)) item.forEach(visit);
      else if (item && typeof item === 'object') visit(item);
    }
  }
  visit(project);
  const missing = [...new Set(references.filter(referenceId => !ids.has(referenceId)))];
  if (missing.length) throw new Error(`Références StarUML introuvables : ${missing.join(', ')}`);
  if (diagrams.length < 10) throw new Error(`Le projet ne contient que ${diagrams.length} diagrammes.`);
  return { elements: ids.size, diagrams: diagrams.length };
}

const project = element('Project', null, { name: 'Plateforme Label INPG - UML complet', ownedElements: [] });
createUseCaseModel(project);
const dataModel = createDataModel(project);
createEnumerationDiagram(dataModel);
createObjectDiagram(dataModel);
createStateModels(project);
createActivityModel(project);
createSequenceModels(project);
createArchitectureModels(project);
createPackageModel(project);
createDesignModels(project);
createErdModel(project);

const summary = validateProject(project);
const outputPath = path.join(__dirname, 'label-inpg-complet-final.mdj');
fs.writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
console.log(`Projet StarUML généré : ${outputPath}`);
console.log(`${summary.diagrams} diagrammes, ${summary.elements} éléments et vues.`);
