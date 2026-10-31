"""The story library: eight public-domain tales, retold short (300-500 words) for ages 3-6 with the child
as the main character. The pictures for every page are drawn in the browser (web/pages/_scenes.html,
LH.SCENES[key][page]); keep the page counts in step (the flow test checks it).

Tokens in the text are filled in the browser by LH.fill (web/pages/_avatar.html) from the hero's name and
pronouns:  {name}  {he} {He}  {him}  {his} {His}  {child} (girl/boy/child)  {royal} {royals}
(princess/prince/royal). Write so "they" also reads well: past tense, no "he is / he has".
"""
import re

import anvil.server

STORIES = [
    {
        "key": "bears",
        "title": "{name} and the Three Bears",
        "plain": "The Three Bears",
        "source": "Retold from “The Story of the Three Bears” by Robert Southey (1837), in the public domain.",
        "blurb": "Porridge, three chairs, three beds, and a brand-new best friend.",
        "color": "#ef5a36",
        "pages": [
            "Once upon a time, at the edge of a sunny wood, there was a little cottage with a red door. In it lived three bears: big Papa Bear, middle-sized Mama Bear, and wee Baby Bear, who had a blue bow tie and the bounciest feet in the forest.",
            "One morning the bears made porridge for breakfast. “Too hot!” said Papa Bear. So off they went for a walk while it cooled. Just then, {name} came skipping down the path, picking daisies and humming {his} favourite song.",
            "{name} saw the little cottage and knocked on the red door. Nobody answered. The door creaked open, and a warm, sweet smell floated out. “Hello?” called {name}. Inside were three bowls of porridge on the table.",
            "{name} tried the big bowl. “Too hot!” Then the middle bowl. “Too cold!” Then the wee bowl. “Just right!” said {name}, and before {he} knew it, the little bowl was empty. Oops!",
            "Next {name} tried the chairs. The big chair was too hard. The middle chair was too squishy. The wee chair was just right, until… CRACK! It broke into pieces, and {name} landed on the floor with a bump.",
            "Feeling sleepy, {name} climbed the stairs. The big bed was too high. The middle bed was too lumpy. But the wee bed was soft and cosy, and {name} snuggled in and fell fast asleep.",
            "Soon the bears came home. “Someone’s been eating my porridge!” squeaked Baby Bear. “And someone’s broken my chair!” Up the stairs they tiptoed. “And someone is sleeping in my bed!”",
            "{name} woke up and saw three bears looking down. “I’m so sorry,” said {name}. “I ate your porridge and broke your chair. Can I help make things right?” Baby Bear thought about it, then smiled a big bear smile.",
            "So {name} helped Papa Bear glue the little chair, and Mama Bear made a fresh pot of porridge for everyone. They ate it together, not too hot and not too cold, and {name} and Baby Bear became the very best of friends.",
        ],
    },
    {
        "key": "turnip",
        "title": "{name} and the Enormous Turnip",
        "plain": "The Enormous Turnip",
        "source": "Retold from the Russian folk tale “The Turnip”, collected by Alexander Afanasyev (1863), in the public domain.",
        "blurb": "Grandpa, Grandma, a dog, a cat and one small mouse: everybody pull!",
        "color": "#3dbe8b",
        "pages": [
            "In a cheerful little garden lived Grandpa, Grandma and {name}, along with a dog, a cat and one small mouse. Every spring they planted seeds in neat rows and watered them with a bright yellow watering can.",
            "One day {name} planted a turnip seed and whispered, “Grow, little turnip, grow sweet and grow strong!” And it did. It grew and grew and GREW, until it was the most enormous turnip anybody had ever seen.",
            "“Time to pull it up for soup!” said Grandpa. He grabbed the leaves and pulled. He pulled and he pulled, but the turnip would not come up. “Grandma, come and help!” he called.",
            "Grandma held on to Grandpa, and Grandpa held on to the turnip. They pulled and they pulled, but the turnip would not come up. “{name}, come and help!” called Grandma.",
            "{name} held on to Grandma, Grandma held on to Grandpa, and Grandpa held on to the turnip. They pulled and they pulled. Still the turnip would not come up! So {name} whistled for the dog.",
            "The dog pulled {name}, and then the cat pulled the dog. They puffed and they huffed. The turnip wiggled a tiny bit, but it stayed in the ground. “We need one more helper,” said {name}. “Someone small but strong!”",
            "Out of the hedge popped the little mouse. “I can help!” she squeaked. The mouse pulled the cat, the cat pulled the dog, the dog pulled {name}, {name} pulled Grandma, Grandma pulled Grandpa, and Grandpa pulled the turnip…",
            "POP! Out came the enormous turnip, and everybody tumbled over in a giggling heap. {name} laughed so hard {his} tummy hurt. “We did it!” {he} cheered. “Even the smallest helper made the biggest difference!”",
            "That night they cooked the biggest pot of turnip soup the village had ever tasted. Everyone came to share it, and the little mouse got the very first spoonful.",
        ],
    },
    {
        "key": "porridge",
        "title": "{name} and the Magic Porridge Pot",
        "plain": "The Magic Porridge Pot",
        "source": "Retold from “Sweet Porridge” by the Brothers Grimm (1812), in the public domain.",
        "blurb": "Cook, little pot, cook! But what were the words to make it stop?",
        "color": "#ffc93c",
        "pages": [
            "In a small town full of crooked chimneys lived {name} and {his} mother. They were kind and cheerful, but some days their cupboard was empty, and their tummies rumbled like thunder.",
            "One morning {name} went into the woods to pick berries. There {he} met a kind old woman with a basket. “You have a good heart,” she said, and she gave {name} a little black pot.",
            "“This pot is magic,” whispered the old woman. “Say ‘Cook, little pot, cook!’ and it will make sweet porridge. When you have enough, say ‘Stop, little pot!’” {name} said thank you and ran all the way home.",
            "“Cook, little pot, cook!” said {name}. Bubble, bubble! The pot filled with warm, sweet porridge. “Stop, little pot!” said {name}, and it stopped. That night, {name} and {his} mother ate until they were happily full.",
            "The next day, {name} went out to play. Mother felt hungry, so she said, “Cook, little pot, cook!” The pot bubbled and filled with porridge. But Mother could not remember the magic words to make it stop!",
            "The porridge bubbled over the top. It ran across the table and spilled onto the floor. It filled the kitchen, then poured out of the door and down the street in a great, gloopy river!",
            "Neighbours climbed onto their roofs. A dog paddled past. The baker’s cat floated by on a loaf of bread. “Oh dear, oh dear!” cried everyone. Soon only one house in the whole town was left without porridge.",
            "Just then {name} came running home. {He} took a deep breath and shouted as loudly as {he} could, “STOP, LITTLE POT!” And with one last bloop, the pot stopped.",
            "Anyone who wanted to get back into town that day had to eat their way home! {name} grabbed the biggest spoon and started first. And from then on, everybody remembered the magic words.",
        ],
    },
    {
        "key": "emperor",
        "title": "{name} and the Emperor’s New Clothes",
        "plain": "The Emperor’s New Clothes",
        "source": "Retold from “The Emperor’s New Clothes” by Hans Christian Andersen (1837), in the public domain.",
        "blurb": "Everybody pretends. Only one brave voice tells the truth.",
        "color": "#8a6bd8",
        "pages": [
            "Long ago there lived an Emperor who loved new clothes more than anything. He had a coat for every hour of the day and a hat for every kind of weather. {name} lived in his city and loved to watch his parades.",
            "One day two tricksters came to town. “We weave the most wonderful cloth in the world,” they said. “It is so special that anyone who is silly or bad at their job cannot see it at all!”",
            "The Emperor gave them bags of gold. The tricksters set up two looms and pretended to weave all day and all night. But their looms were completely empty. There was no cloth at all!",
            "The Emperor sent his wisest minister to look. The minister saw nothing. “Oh no,” he thought. “Does this mean I am silly?” So he said, “How beautiful! What colours!” Nobody wanted to say they saw nothing.",
            "At last the suit was ready. The tricksters pretended to dress the Emperor, one invisible sleeve at a time. “Light as a feather,” they said. The Emperor turned this way and that in front of the mirror.",
            "Then the great parade began. Trumpets played and flags waved. The whole town lined the streets. “What a marvellous suit!” everyone cried, even though all they could see were the Emperor’s spotty underpants.",
            "{name} was standing at the front of the crowd. {He} looked at the Emperor, and then looked again. Then {name} said, loudly and clearly, “But the Emperor isn’t wearing any clothes!”",
            "There was a hush. Then someone giggled. Then everyone laughed. “{name} is right!” they said. The Emperor’s cheeks went pink. He knew it was true, so he started to laugh too.",
            "The Emperor thanked {name} for being brave and honest. He gave {name} a shiny medal, and from that day on he always listened when someone told him the truth, even when it was a little bit funny.",
        ],
    },
    {
        "key": "beanstalk",
        "title": "{name} and the Beanstalk",
        "plain": "The Magic Beanstalk",
        "source": "Retold from “Jack and the Beanstalk” in Joseph Jacobs’ English Fairy Tales (1890), in the public domain.",
        "blurb": "Five magic beans, a beanstalk to the clouds, and a lonely giant.",
        "color": "#4ea8f5",
        "pages": [
            "{name} lived in a tiny cottage with {his} mother and a gentle cow named Milky-White. One day, Milky-White stopped giving milk, and the cupboard was nearly bare. “Take her to market,” said Mother, “and sell her for a good price.”",
            "On the way, {name} met a funny little man with a feather in his hat. “I’ll trade you these five magic beans for your cow,” he said. The beans sparkled like tiny jewels, so {name} said yes.",
            "Mother was not pleased. “Beans? Just beans?” she cried, and she tossed them out of the window. But that night, while {name} slept, something amazing happened. The beans began to grow.",
            "In the morning, a huge beanstalk reached all the way up into the clouds! {name} grabbed a leaf, then another, and climbed, and climbed, and climbed, higher than the birds, until {he} stepped onto a fluffy cloud.",
            "On the cloud stood an enormous castle. {name} knocked on the gigantic door. BOOM, BOOM, BOOM went the footsteps. “FEE-FI-FO-FUM!” rumbled a voice, and a giant peered down at {name}, very surprised.",
            "The giant looked grumpy, but {name} noticed a tear in his eye. “Nobody ever visits me,” sniffed the giant. “Everyone runs away.” So {name} said, “I’ll visit! Would you like to play a game?”",
            "They played hide-and-seek in the giant’s garden, where the daisies were as big as umbrellas. The giant laughed so hard that the whole cloud wobbled, and his hen clucked and laid a shining golden egg.",
            "“Take this, my friend,” said the giant, and he gave {name} the golden egg. “Please come back and play again.” {name} promised {he} would, and climbed all the way back down the beanstalk.",
            "With the golden egg, {name} and Mother bought Milky-White back and filled the cupboard with good things. And every Sunday, {name} climbed the beanstalk to play with {his} giant friend in the clouds.",
        ],
    },
    {
        "key": "hen",
        "title": "{name} and the Little Red Hen",
        "plain": "The Little Red Hen",
        "source": "Retold from the traditional folk tale “The Little Red Hen” (printed in the 1870s), in the public domain.",
        "blurb": "“Not I!” said the Cat, the Dog and the Duck. “I will!” said our hero.",
        "color": "#ff8fb8",
        "pages": [
            "On a busy little farm lived a Little Red Hen, a sleepy Cat, a lazy Dog and a noisy Duck. {name} lived on the farm too, and loved to help with everything, from feeding the chicks to counting the eggs.",
            "One morning the Little Red Hen found some grains of wheat. “Who will help me plant this wheat?” she asked. “Not I,” yawned the Cat. “Not I,” sighed the Dog. “Not I,” quacked the Duck. “I will!” said {name}.",
            "So {name} and the Little Red Hen planted the wheat in neat little rows. The sun shone and the rain fell, and the wheat grew tall and golden, right up to {name}’s nose.",
            "“Who will help me cut the wheat?” asked the Little Red Hen. “Not I,” said the Cat, the Dog and the Duck, without even opening their eyes. “I will!” said {name}, and off they went to the field.",
            "“Who will help me take the wheat to the mill?” “Not I,” said the Cat, the Dog and the Duck. “I will!” said {name}. Together they pulled a creaky cart to the windmill, where the wheat was ground into soft white flour.",
            "“Who will help me bake the bread?” asked the Little Red Hen. “Not I!” said the Cat, the Dog and the Duck. “I will!” said {name}. They mixed and kneaded and waited for the dough to puff up big and round.",
            "Soon a warm, golden loaf came out of the oven. The smell drifted all over the farm, and suddenly the Cat, the Dog and the Duck were wide awake. “Who will help me eat the bread?” asked the Little Red Hen.",
            "“I will!” said the Cat. “I will!” said the Dog. “I will!” said the Duck. The Little Red Hen shook her head. “You did not help plant it, cut it or bake it. {name} and I did all the work.”",
            "The Cat, the Dog and the Duck looked down at their paws and feet. “Next time, we’ll help,” they said. {name} smiled and gave each of them a piece anyway. “Next time,” said {name}, “we’ll bake two loaves together!”",
        ],
    },
    {
        "key": "elves",
        "title": "{name} and the Elves",
        "plain": "The Elves and the Shoemaker",
        "source": "Retold from “The Elves and the Shoemaker” by the Brothers Grimm (1812), in the public domain.",
        "blurb": "Who is making the shoes at midnight? A cosy tale of kindness.",
        "color": "#2fa39b",
        "pages": [
            "{name} lived above a little shoe shop with {his} dad, the shoemaker. Dad made fine shoes, but times were hard. One evening he had only enough leather left for one last pair.",
            "Dad cut out the leather and laid it on his workbench, ready to sew in the morning. “Goodnight, little shoes,” said {name}, and they both went up to bed.",
            "In the morning, {name} raced downstairs. On the workbench stood a beautiful pair of shoes, with tiny, neat stitches. “Who made these?” gasped Dad. A lady bought them straight away and paid enough for leather for two more pairs.",
            "That night Dad cut out two pairs, and in the morning two beautiful pairs were finished! The next night four, then eight. Soon the shop was full of happy customers, and everyone in town wanted shoes from the little shop.",
            "“Who could be helping us?” wondered {name}. So one night, {name} and Dad hid behind a curtain with a candle. At midnight, two little elves skipped in through the window and began to sew, tap-tap-tap, as fast as they could.",
            "{name} noticed something. The elves had no coats and no shoes, and their little toes looked cold. “They have helped us so much,” whispered {name}. “Let’s make them something too.”",
            "So {name} and Dad got busy. Dad made two tiny pairs of shoes. {name} sewed two tiny coats, knitted two tiny scarves and made two tiny hats with bobbles on top. They laid the presents on the workbench.",
            "At midnight the elves found the presents. They squealed with joy, put on their new clothes and danced around the workshop. “Now we are fine and warm!” they sang, and away they skipped through the window.",
            "The elves never came back to sew, but they did not need to. The shop stayed busy and happy. And whenever {name} found a tiny bobble-hat drawn in the frost on the window, {he} knew the elves were saying hello.",
        ],
    },
    {
        "key": "pea",
        "title": "{name} and the Pea",
        "plain": "The Princess and the Pea",
        "source": "Retold from “The Princess and the Pea” by Hans Christian Andersen (1835), in the public domain.",
        "blurb": "Twenty mattresses, twenty quilts, and one tiny green pea.",
        "color": "#5b8def",
        "pages": [
            "Once upon a time, in a castle on a hill, lived a King and a Queen. They had heard many stories about real {royals}, who were so gentle that they could feel the tiniest thing. “I wonder if any are left,” said the Queen.",
            "One stormy night, the rain poured down and the thunder rumbled. KNOCK, KNOCK, KNOCK! At the castle gate stood {name}, soaking wet from head to toe, with water running out of {his} shoes.",
            "“I got lost in the storm,” said {name}. “May I stay the night? At home they call me a real {royal}.” The King raised an eyebrow. The Queen smiled a secret smile. “We shall see,” she said.",
            "While {name} drank warm cocoa by the fire, the Queen crept into the guest room. She put one tiny green pea on the bed. Then she piled twenty mattresses on top of it, and twenty fluffy quilts on top of those.",
            "The bed was so tall that {name} needed a ladder to climb in. “Goodnight!” called the King and Queen from far below. {name} waved from the very top, close enough to touch the ceiling.",
            "But {name} could not sleep. {He} wiggled to the left and wobbled to the right. {He} counted sheep, then goats, then ducks. All night long, something small and hard poked {him} in the back.",
            "In the morning, the Queen asked, “Did you sleep well?” “Not a wink!” yawned {name}. “There was something lumpy in my bed. I think I’m black and blue!” The King and Queen gasped with delight.",
            "“Only a real {royal} could feel one tiny pea through twenty mattresses and twenty quilts!” cried the Queen. They gave {name} a golden crown and the biggest breakfast in the whole kingdom.",
            "And the pea? It was put in the royal museum, where you can still see it today, unless somebody has eaten it. {name} visited the castle every summer, and always slept on just one mattress.",
        ],
    },
]
BY_KEY = {s["key"]: s for s in STORIES}
TOKENS = {"name", "he", "He", "him", "his", "His", "child", "royal", "royals"}
SAMPLE = {"name": "Mila", "he": "she", "He": "She", "him": "her", "his": "her", "His": "Her", "child": "girl",
          "royal": "princess", "royals": "princesses"}


def fill(text, values=None):
    values = values or SAMPLE
    return re.sub(r"\{(\w+)\}", lambda m: values.get(m.group(1), m.group(0)), text)


def words(story):
    return sum(len(fill(p).split()) for p in story["pages"])


def meta(s):
    """What the library and the shelf show (no page text)."""
    return {"key": s["key"], "title": s["title"], "plain": s["plain"], "source": s["source"], "blurb": s["blurb"],
            "color": s["color"], "pages": len(s["pages"]), "words": words(s),
            "minutes": max(2, round(words(s) / 110))}


def full(s):
    out = meta(s)
    out["text"] = list(s["pages"])
    return out


@anvil.server.callable
def get_story(key):
    """One story with its text (public: they're all public-domain tales)."""
    s = BY_KEY.get(key if isinstance(key, str) else "")
    if s is None:
        return {"ok": False, "error": "That story isn't in the library."}
    return {"ok": True, "story": full(s)}
