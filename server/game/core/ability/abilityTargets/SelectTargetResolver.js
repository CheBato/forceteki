const { SelectChoice } = require('./SelectChoice.js');
const { Stage, RelativePlayer } = require('../../Constants.js');
const Contract = require('../../utils/Contract.js');
const { GameSystem } = require('../../gameSystem/GameSystem.js');

/** Target resolver for selecting between multiple prompted choices due to an effect */
class SelectTargetResolver {
    constructor(name, properties, ability) {
        this.name = name;
        this.properties = properties;
        this.dependentTarget = null;
        this.dependentCost = null;
        if (this.properties.dependsOn) {
            let dependsOnTarget = ability.targetResolvers.find((target) => target.name === this.properties.dependsOn);

            // assert that the target we depend on actually exists
            Contract.assertNotNullLike(dependsOnTarget);

            dependsOnTarget.dependentTarget = this;
        }
    }

    canResolve(context) {
        return !!this.properties.dependsOn || this.hasLegalTarget(context);
    }

    hasLegalTarget(context) {
        let keys = Object.keys(this.getChoices(context));
        return keys.some((key) => this.isChoiceLegal(key, context));
    }

    getChoices(context) {
        if (typeof this.properties.choices === 'function') {
            return this.properties.choices(context);
        }
        return this.properties.choices;
    }

    isChoiceLegal(key, context) {
        let contextCopy = context.copy();
        contextCopy.selects[this.name] = new SelectChoice(key);
        if (this.name === 'target') {
            contextCopy.select = key;
        }
        if (context.stage === Stage.PreTarget && this.dependentCost && !this.dependentCost.canPay(contextCopy)) {
            return false;
        }
        if (this.dependentTarget && !this.dependentTarget.hasLegalTarget(contextCopy)) {
            return false;
        }
        let choice = this.getChoices(context)[key];
        if (typeof choice === 'function') {
            return choice(contextCopy);
        }
        return choice.hasLegalTarget(contextCopy);
    }

    /** @returns {GameSystem[]} */
    getGameSystems(context) {
        if (!context.selects[this.name]) {
            return [];
        }
        let choice = this.getChoices(context)[context.selects[this.name].choice];
        if (typeof choice !== 'function') {
            return choice;
        }
        return [];
    }

    getAllLegalTargets(context) {
        return Object.keys(this.getChoices(context)).filter((key) => this.isChoiceLegal(key, context));
    }

    // TODO: add passHandler here so that player can potentially be prompted for pass earlier in the window
    resolve(context, targetResults) {
        if (targetResults.cancelled || targetResults.payCostsFirst || targetResults.delayTargeting) {
            return;
        }
        if (this.properties.condition && !this.properties.condition(context)) {
            return;
        }

        let player = (this.properties.targetResolvers && context.choosingPlayerOverride) || this.getChoosingPlayer(context);
        if (player === context.player.opponent && context.stage === Stage.PreTarget) {
            targetResults.delayTargeting = this;
            return;
        }
        let promptTitle = this.properties.activePromptTitle || 'Select one';
        let choices = Object.keys(this.getChoices(context)).filter((key) => this.isChoiceLegal(key, context));
        let handlers = choices.map((choice) => {
            return () => {
                context.selects[this.name] = new SelectChoice(choice);
                if (this.name === 'target') {
                    context.select = choice;
                }
            };
        });
        if (player !== context.player.opponent && context.stage === Stage.PreTarget) {
            if (!targetResults.noCostsFirstButton) {
                choices.push('Pay costs first');
                handlers.push(() => (targetResults.payCostsFirst = true));
            }
            choices.push('Cancel');
            handlers.push(() => (targetResults.cancelled = true));
        }
        if (handlers.length === 1) {
            handlers[0]();
        } else if (handlers.length > 1) {
            let waitingPromptTitle = '';
            if (context.stage === Stage.PreTarget) {
                if (context.ability.type === 'action') {
                    waitingPromptTitle = 'Waiting for opponent to take an action or pass';
                } else {
                    waitingPromptTitle = 'Waiting for opponent';
                }
            }
            context.game.promptWithHandlerMenu(player, {
                waitingPromptTitle: waitingPromptTitle,
                activePromptTitle: promptTitle,
                context: context,
                source: this.properties.source || context.source,
                choices: choices,
                handlers: handlers
            });
        }
    }

    checkTarget(context) {
        if (
            this.properties.targetResolvers &&
            context.choosingPlayerOverride &&
            this.getChoosingPlayer(context) === context.player
        ) {
            return false;
        }
        return !!context.selects[this.name] && this.isChoiceLegal(context.selects[this.name].choice, context);
    }

    getChoosingPlayer(context) {
        let playerProp = this.properties.choosingPlayer;
        if (typeof playerProp === 'function') {
            playerProp = playerProp(context);
        }
        return playerProp === RelativePlayer.Opponent ? context.player.opponent : context.player;
    }

    hasTargetsChosenByInitiatingPlayer(context) {
        if (this.properties.targetResolvers) {
            return true;
        }
        let actions = Object.values(this.getChoices(context)).filter((value) => typeof value !== 'function');
        return actions.some((action) => action.hasTargetsChosenByInitiatingPlayer(context));
    }
}

module.exports = SelectTargetResolver;
