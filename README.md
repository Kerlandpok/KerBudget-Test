# KerBudget 3.7.1 Test

- Gestion multi-années et archives.
- Préparation de la nouvelle année avec report du solde pointé au 31 décembre.
- Copie des budgets, conservation des catégories, récurrences et paramètres.
- Sauvegarde locale automatique avant transition.
- Sélecteur d’année accessible depuis les pages mensuelles et Plus.

KerBudget 3.5.7 Test

- Confirmation de suppression intégrée à l’application
- Suppression directe par position avec vérification après sauvegarde
- Message d’erreur visible en cas d’échec

# KerBudget 3.5.5 Test

- Refonte responsive de la Synthèse annuelle.
- Quatre indicateurs : revenus, dépenses, épargne et solde annuels.
- Cartes mensuelles pliables avec détail complet.
- Accès direct aux mouvements du mois sélectionné.
- Graphique du solde mensuel adapté au téléphone.
- Données et calculs existants conservés.

# KerBudget 3.4.4 Test

- Audit de la page Budget.
- Résumé Prévu / Dépensé / Disponible / Écart revenus.
- Tri automatique : dépassements, catégories à surveiller, catégories normales, revenus.
- Repères vert, orange et rouge selon la consommation du budget.
- Barres de progression et cartes harmonisées.
- Données et calculs existants conservés.

# KerBudget 3.4.2 Test

- Suppression du bouton « + Ajouter » sur la page Mouvements.
- Filtres « Toutes / Pointées / À pointer » maintenus sur une seule ligne.
- Filtres de type répartis sur toute la largeur de l’écran.
- Conservation des raccourcis Revenu, Facture, Dépense et Épargne.
- Données et calculs existants conservés.

KerBudget 3.2.0 Test

Nouvel accueil Aujourd’hui, navigation simplifiée, alertes intelligentes et accès direct aux prévisions.

KerBudget 3.1.0 Test

- Refonte de la page Budget : résumé, progression par catégorie et saisie plus claire.
- Conservation des calculs et des données existantes.

# KerBudget 3.0.1 Test

Disponible mis en avant, suppression du doublon Reste budget, budget consommé, meilleure lisibilité de À venir et alertes recalculées.


## Version 3.1.1 Test
- Ajout d’un accès visible à la page Budget depuis l’accueil et le menu Plus.
- Conservation de la nouvelle vue Budget 3.1.


Version 3.3.2 : formulaires Nouveau mouvement et Modifier modernisés, type rapide, montant mis en avant, détails repliables et statut sous forme d’interrupteur.


Version 3.4.1 : correction du versionnage visible et renouvellement forcé du cache PWA pour afficher le nouveau formulaire.


Version 3.4.1 : suppression des analyses redondantes avec les cartes Aujourd’hui, suppression du doublon Bilan mensuel dans Plus et correction renforcée des accès Épargne.


Version 3.4.1 : navigation Épargne explicite et refonte responsive de la Synthèse annuelle.


## Correction 3.4.1
- Réparation réelle de la page Épargne : ajout de la fonction de rendu de la liste manquante.
- Navigation Épargne uniformisée avec le système standard de l’application.


## Version 3.4.2 Test
- Ajout du centre de diagnostic dans Plus.
- Vérification des catégories, sous-catégories, budgets, doublons et virements d’épargne.
- Rapport de diagnostic téléchargeable.

## Version 3.4.2 Test — Audit 4.0, sprint 1
- Suppression complète de la détection des doublons dans le diagnostic.
- Refonte de la page À venir en prévision chronologique.
- Filtres par type : Tous, Revenus, Factures, Dépenses, Épargne.
- Horizons : 7 jours, 15 jours, fin du mois.
- Regroupement Aujourd’hui, Demain, Cette semaine, Semaine prochaine et Plus tard.
- Solde estimé affiché après chaque période.


## 3.5.5 Test
- Paramètres de prévision : jours ouvrés, jours fériés français et délai des dépenses non pointées.
- Intégration des dépenses non pointées dont la date est passée dans la page À venir.


## Correctif 3.5.3
- Suppression, modification et pointage compatibles avec les anciens identifiants numériques et les nouveaux identifiants texte.
- Message explicite si un mouvement ne peut pas être retrouvé.


## Correctif 3.5.5
- La suppression d’un mouvement récurrent est mémorisée afin qu’il ne soit pas recréé au rechargement.
- Vérification de la persistance locale après suppression.


## Version 3.5.5
- Symbole ↻ sur les mouvements issus d’une récurrence.
- Factures récurrentes et virements d’épargne récurrents séparés dans l’interface.
- Accès aux virements récurrents depuis la page Épargne.


## 3.5.7 Test
- Correction des états de budget : 0 % = Budget non commencé, 100 % = Budget atteint, rouge uniquement au-delà de 100 %.
- Tolérance de 0,01 € pour éviter les faux dépassements dus aux arrondis.
- Même logique utilisée sur Budget, Aujourd’hui et les alertes.


## Correctif 3.7.1
- Rétablissement des pages Aujourd’hui et À venir.
- Optimisation du calcul des échéances de prêts dans les prévisions.
- Protection d’affichage en cas d’erreur.
