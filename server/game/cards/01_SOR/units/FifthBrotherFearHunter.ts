import AbilityHelper from '../../../AbilityHelper';
import { NonLeaderUnitCard } from '../../../core/card/NonLeaderUnitCard';
import { KeywordName, Location } from '../../../core/Constants';

export default class FirstLegionSnowtrooper extends NonLeaderUnitCard {
    protected override getImplementationId() {
        return {
            id: '8395007579',
            internalName: 'fifth-brother#fear-hunter',
        };
    }

    public override setupCardAbilities() {
        this.addConstantAbility({
            title: 'This unit gains Raid 1 for each damage on him',
            matchTarget: (card, context) => card === context.source,
            ongoingEffect: (context) => AbilityHelper.ongoingEffects.gainKeyword({ keyword: KeywordName.Raid, amount: context.source.damage() })
        });


        this.addOnAttackAbility({
            title: 'You may deal 1 damage to this unit and 1 damage to another ground unit.',
            optional: true,
            targetResolver: {
                cardCondition: (card, context) => (card.controller !== context.source.controller && card.location === Location.GroundArena),
                immediateEffect: AbilityHelper.immediateEffects.simultaneous([
                    AbilityHelper.immediateEffects.damage((context) => ({ target: context.source, amount: 1 })),
                    AbilityHelper.immediateEffects.damage((context) => ({ target: context.target, amount: 1 })),
                ]),
            },
        });
    }
}

FirstLegionSnowtrooper.implemented = true;